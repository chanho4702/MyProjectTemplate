package dev.platform.starter.kafka;

import java.time.Instant;
import java.util.UUID;

public record DomainEvent<T>(
        UUID eventId,
        String eventType,
        int schemaVersion,
        Instant occurredAt,
        String source,
        String correlationId,
        T payload
) {
}
