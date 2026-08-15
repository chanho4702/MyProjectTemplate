package dev.platform.sample.item;

import java.time.Instant;
import java.util.UUID;

record ItemResponse(UUID id, String name, Instant createdAt) {
    static ItemResponse from(Item item) {
        return new ItemResponse(item.getId(), item.getName(), item.getCreatedAt());
    }
}
