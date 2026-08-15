package dev.platform.starter.search;

public interface SearchGateway {
    <T> String index(String index, String id, T document);

    void delete(String index, String id);

    <T> SearchPage<T> query(String index, String queryText, Class<T> documentType, int page, int size);
}
