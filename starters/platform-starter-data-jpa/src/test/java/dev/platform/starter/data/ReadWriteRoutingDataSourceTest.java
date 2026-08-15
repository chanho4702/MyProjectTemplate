package dev.platform.starter.data;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.assertj.core.api.Assertions.assertThat;

class ReadWriteRoutingDataSourceTest {
    private final TestRoutingDataSource routing = new TestRoutingDataSource();

    @AfterEach
    void clearTransactionState() {
        TransactionSynchronizationManager.clear();
    }

    @Test
    void usesWriterByDefault() {
        assertThat(routing.currentRole()).isEqualTo(DataSourceRole.WRITER);
    }

    @Test
    void usesReaderOnlyForReadOnlyTransaction() {
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);
        assertThat(routing.currentRole()).isEqualTo(DataSourceRole.READER);
    }

    private static final class TestRoutingDataSource extends ReadWriteRoutingDataSource {
        Object currentRole() {
            return determineCurrentLookupKey();
        }
    }
}
