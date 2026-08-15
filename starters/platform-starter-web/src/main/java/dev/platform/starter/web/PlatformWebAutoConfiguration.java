package dev.platform.starter.web;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

import java.time.Clock;

@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(PlatformWebProperties.class)
public class PlatformWebAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    Clock platformClock() {
        return Clock.systemUTC();
    }

    @Bean
    FilterRegistrationBean<RequestIdFilter> platformRequestIdFilter(PlatformWebProperties properties) {
        FilterRegistrationBean<RequestIdFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RequestIdFilter(properties.getRequestIdHeader()));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    CommonExceptionHandler platformCommonExceptionHandler() {
        return new CommonExceptionHandler();
    }
}
