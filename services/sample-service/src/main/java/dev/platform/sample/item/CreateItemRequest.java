package dev.platform.sample.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record CreateItemRequest(
        @NotBlank
        @Size(max = 120)
        String name
) {
}
