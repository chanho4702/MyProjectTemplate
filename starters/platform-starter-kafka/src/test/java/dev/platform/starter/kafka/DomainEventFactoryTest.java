package dev.platform.starter.kafka;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class DomainEventFactoryTest {
    @Test
    void createsVersionedEventEnvelope() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-15T00:00:00Z"), ZoneOffset.UTC);
        DomainEventFactory factory = new DomainEventFactory(clock, "order-service");

        DomainEvent<String> event = factory.create("order.created", 1, "request-1", "payload");

        assertThat(event.eventType()).isEqualTo("order.created");
        assertThat(event.schemaVersion()).isEqualTo(1);
        assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-08-15T00:00:00Z"));
        assertThat(event.source()).isEqualTo("order-service");
    }
}
