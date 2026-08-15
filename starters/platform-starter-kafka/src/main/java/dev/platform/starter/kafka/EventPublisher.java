package dev.platform.starter.kafka;

import java.util.concurrent.CompletionStage;

public interface EventPublisher {
    CompletionStage<EventPublishResult> publish(String topic, String key, DomainEvent<?> event);
}
