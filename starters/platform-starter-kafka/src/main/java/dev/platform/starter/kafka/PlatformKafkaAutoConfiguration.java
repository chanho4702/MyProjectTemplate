package dev.platform.starter.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

@AutoConfiguration
@ConditionalOnProperty(prefix = "platform.kafka", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(PlatformKafkaProperties.class)
public class PlatformKafkaAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    Clock platformKafkaClock() {
        return Clock.systemUTC();
    }

    @Bean(name = "platformKafkaOperations")
    KafkaOperations<String, String> platformKafkaOperations(KafkaProperties kafkaProperties) {
        Map<String, Object> configuration = new HashMap<>(kafkaProperties.buildProducerProperties(null));
        configuration.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configuration.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configuration.putIfAbsent(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        configuration.putIfAbsent(ProducerConfig.ACKS_CONFIG, "all");
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(configuration));
    }

    @Bean
    @ConditionalOnMissingBean
    DomainEventFactory platformDomainEventFactory(Clock clock, PlatformKafkaProperties properties) {
        return new DomainEventFactory(clock, properties.getSource());
    }

    @Bean
    @ConditionalOnMissingBean
    EventPublisher platformEventPublisher(
            KafkaOperations<String, String> platformKafkaOperations,
            ObjectMapper objectMapper
    ) {
        return new KafkaEventPublisher(platformKafkaOperations, objectMapper);
    }
}
