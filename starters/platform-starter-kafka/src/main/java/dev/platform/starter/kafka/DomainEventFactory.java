package dev.platform.starter.kafka;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

public final class DomainEventFactory {
    private final Clock clock;
    private final String source;

    public DomainEventFactory(Clock clock, String source) {
        this.clock = clock;
        this.source = source;
    }

    public <T> DomainEvent<T> create(
            String eventType,
            int schemaVersion,
            String correlationId,
            T payload
    ) {
        return new DomainEvent<>(
                UUID.randomUUID(),
                eventType,
                schemaVersion,
                Instant.now(clock),
                source,
                correlationId,
                payload
        );
    }
}
