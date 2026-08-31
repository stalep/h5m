package io.hyperfoil.tools.h5m.cli;

import org.aesh.command.validator.OptionValidator;
import org.aesh.command.validator.OptionValidatorException;
import org.aesh.command.validator.ValidatorInvocation;

import io.hyperfoil.tools.h5m.api.ReservedNamespace;

/**
 * aesh {@link OptionValidator} that rejects CLI option values on the reserved namespace.
 * Keeps the aesh dependency out of the {@code api} package by delegating to {@link ReservedNamespace#isReserved(String)}.
 * <p>
 * Reference it on an option: {@code @Option(validator = ReservedNamespaceValidator.class)}.
 */
public class ReservedNamespaceValidator implements OptionValidator<ValidatorInvocation<String, ?>> {

    @Override
    public void validate(ValidatorInvocation<String, ?> validatorInvocation) throws OptionValidatorException {
        String name = validatorInvocation.getValue();
        if (ReservedNamespace.isReserved(name)) {
            throw new OptionValidatorException("Names starting with '" + ReservedNamespace.RESERVED_PREFIX + "' are reserved for internal use: " + name);
        }
    }
}
