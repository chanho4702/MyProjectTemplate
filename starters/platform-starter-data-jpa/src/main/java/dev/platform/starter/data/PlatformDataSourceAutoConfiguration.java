package dev.platform.starter.data;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.util.Map;

@AutoConfiguration
@AutoConfigureBefore(DataSourceAutoConfiguration.class)
@ConditionalOnProperty(prefix = "platform.datasource", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(PlatformDataSourceProperties.class)
public class PlatformDataSourceAutoConfiguration {
    @Bean(name = "platformWriterDataSource", destroyMethod = "close")
    HikariDataSource platformWriterDataSource(PlatformDataSourceProperties properties) {
        if (!properties.getWriter().configured()) {
            throw new IllegalStateException("platform.datasource.writer.url is required when datasource routing is enabled");
        }
        return createPool("writer", properties.getWriter(), properties.getPool());
    }

    @Bean(name = "platformReaderDataSource", destroyMethod = "close")
    HikariDataSource platformReaderDataSource(PlatformDataSourceProperties properties) {
        PlatformDataSourceProperties.Endpoint endpoint = properties.getReader().configured()
                ? properties.getReader()
                : properties.getWriter();
        return createPool("reader", endpoint, properties.getPool());
    }

    @Bean
    @Primary
    @ConditionalOnMissingBean(name = "dataSource")
    DataSource dataSource(
            @Qualifier("platformWriterDataSource") DataSource writer,
            @Qualifier("platformReaderDataSource") DataSource reader
    ) {
        ReadWriteRoutingDataSource routing = new ReadWriteRoutingDataSource();
        routing.setTargetDataSources(Map.of(
                DataSourceRole.WRITER, writer,
                DataSourceRole.READER, reader
        ));
        routing.setDefaultTargetDataSource(writer);
        routing.afterPropertiesSet();
        return new LazyConnectionDataSourceProxy(routing);
    }

    private static HikariDataSource createPool(
            String role,
            PlatformDataSourceProperties.Endpoint endpoint,
            PlatformDataSourceProperties.Pool pool
    ) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("platform-" + role);
        config.setJdbcUrl(endpoint.getUrl());
        config.setUsername(endpoint.getUsername());
        config.setPassword(endpoint.getPassword());
        config.setMaximumPoolSize(pool.getMaximumSize());
        config.setMinimumIdle(pool.getMinimumIdle());
        config.setConnectionTimeout(pool.getConnectionTimeoutMs());
        config.setInitializationFailTimeout(-1);
        return new HikariDataSource(config);
    }
}
