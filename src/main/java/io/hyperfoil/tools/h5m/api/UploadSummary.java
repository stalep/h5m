package io.hyperfoil.tools.h5m.api;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Summary of an upload (root value) for listing in the folder detail view.
 */
@Schema(description = "Summary of an uploaded data entry")
public record UploadSummary(
    @Schema(description = "Value ID") long id,
    @Schema(description = "Upload timestamp") LocalDateTime createdAt,
    @Schema(description = "Number of computed descendant values") int valueCount
) {}
