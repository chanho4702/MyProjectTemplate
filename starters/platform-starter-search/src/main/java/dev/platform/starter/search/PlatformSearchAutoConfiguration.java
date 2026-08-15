package dev.platform.starter.search;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;

@AutoConfiguration
@ConditionalOnProperty(prefix = "platform.search", name = "enabled", havingValue = "true")
@ConditionalOnBean(ElasticsearchOperations.class)
@EnableConfigurationProperties(PlatformSearchProperties.class)
public class PlatformSearchAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    SearchGateway platformSearchGateway(
            ElasticsearchOperations operations,
            PlatformSearchProperties properties
    ) {
        return new ElasticsearchSearchGateway(operations, properties.getIndexPrefix());
    }
}
