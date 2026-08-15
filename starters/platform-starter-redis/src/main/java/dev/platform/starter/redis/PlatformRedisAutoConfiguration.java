package dev.platform.starter.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.core.StringRedisTemplate;

@AutoConfiguration
@ConditionalOnProperty(prefix = "platform.redis", name = "enabled", havingValue = "true")
@ConditionalOnBean(StringRedisTemplate.class)
@EnableConfigurationProperties(PlatformRedisProperties.class)
public class PlatformRedisAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    JsonCache platformJsonCache(
            StringRedisTemplate redis,
            ObjectMapper objectMapper,
            PlatformRedisProperties properties
    ) {
        return new RedisJsonCache(redis, objectMapper, properties.getKeyPrefix());
    }
}
