package io.hyperfoil.tools.h5m.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import io.hyperfoil.tools.h5m.svc.ValueService;
import io.quarkus.logging.Log;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import io.hyperfoil.tools.jjq.JqProgram;
import io.hyperfoil.tools.jjq.jackson.JacksonJqEngine;

import java.util.List;

/**
 * Evaluate jq/js/jsonpath expressions against upload data without persisting.
 * Used by the web UI for live expression testing when creating nodes.
 */
@Path("/api/expression")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Expression", description = "Test expressions against upload data")
public class ExpressionResource {

    private static final JacksonJqEngine JQ_ENGINE = new JacksonJqEngine();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    ValueService valueService;

    @POST
    @Path("try")
    @PermitAll
    @Consumes({MediaType.TEXT_PLAIN, MediaType.APPLICATION_JSON})
    @Operation(description = "Evaluate an expression against a value's data and return the result")
    public JsonNode tryExpression(
            @QueryParam("valueId") @Parameter(description = "Value ID to use as input") Long valueId,
            @QueryParam("type") @Parameter(description = "Expression type: jq, js, jsonpath") @DefaultValue("jq") String type,
            String expression) {

        // Get the input data
        JsonNode input;
        if (valueId != null) {
            input = valueService.getValueData(valueId);
            if (input == null) {
                throw new NotFoundException("Value not found: " + valueId);
            }
        } else {
            throw new BadRequestException("valueId is required");
        }

        if (expression == null || expression.isBlank()) {
            throw new BadRequestException("Expression is required");
        }

        return switch (type) {
            case "jq" -> evaluateJq(expression, input);
            case "js" -> evaluateJs(expression, input);
            default -> throw new BadRequestException("Unsupported expression type: " + type + ". Supported: jq, js");
        };
    }

    @POST
    @Path("try/inline")
    @PermitAll
    @Operation(description = "Evaluate an expression against inline JSON data")
    public JsonNode tryExpressionInline(
            @QueryParam("type") @Parameter(description = "Expression type: jq, js") @DefaultValue("jq") String type,
            @QueryParam("expression") @Parameter(description = "The expression to evaluate") String expression,
            JsonNode input) {

        if (expression == null || expression.isBlank()) {
            throw new BadRequestException("Expression is required");
        }
        if (input == null) {
            throw new BadRequestException("Input JSON is required");
        }

        return switch (type) {
            case "jq" -> evaluateJq(expression, input);
            case "js" -> evaluateJs(expression, input);
            default -> throw new BadRequestException("Unsupported expression type: " + type + ". Supported: jq, js");
        };
    }

    private JsonNode evaluateJq(String expression, JsonNode input) {
        try {
            JqProgram program = JQ_ENGINE.compile(expression);
            List<JsonNode> results = JQ_ENGINE.apply(program, input);
            if (results.isEmpty()) {
                return MAPPER.nullNode();
            } else if (results.size() == 1) {
                return results.getFirst();
            } else {
                ArrayNode array = MAPPER.createArrayNode();
                results.forEach(array::add);
                return array;
            }
        } catch (Exception e) {
            Log.debugf("jq evaluation error: %s", e.getMessage());
            throw new BadRequestException(
                jakarta.ws.rs.core.Response.status(400).entity("jq error: " + e.getMessage()).build());
        }
    }

    private JsonNode evaluateJs(String expression, JsonNode input) {
        try {
            org.graalvm.polyglot.Context context = org.graalvm.polyglot.Context.newBuilder("js")
                .engine(org.graalvm.polyglot.Engine.newBuilder("js")
                    .option("engine.WarnInterpreterOnly", "false").build())
                .allowExperimentalOptions(true)
                .option("js.foreign-object-prototype", "true")
                .build();
            try {
                context.enter();
                String jsCode = "const __input = " + input + ";\n"
                    + "const __func = " + expression + ";\n"
                    + "__func(__input);";
                org.graalvm.polyglot.Value result = context.eval("js", jsCode);
                if (result.isNull()) return MAPPER.nullNode();
                return MAPPER.readTree(result.toString());
            } finally {
                context.leave();
                context.close();
            }
        } catch (Exception e) {
            Log.debugf("JS evaluation error: %s", e.getMessage());
            throw new BadRequestException(
                jakarta.ws.rs.core.Response.status(400).entity("JS error: " + e.getMessage()).build());
        }
    }
}
