package io.hyperfoil.tools.h5m.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.util.Arrays;

/**
 * Deduplicated fingerprint identity for a series.
 * Each unique fingerprint data value per folder per fingerprint node
 * produces one row. Values in the {@code value} table reference this
 * via {@code fingerprint_id} to enable direct indexed lookups instead
 * of recursive CTE DAG traversals.
 */
@Entity(name = "fingerprint_entry")
@Table(name = "fingerprint_entry",
        uniqueConstraints = @UniqueConstraint(columnNames = {"folder_id", "node_id", "hash"}))
public class FingerprintEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    public FolderEntity folder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "node_id")
    public NodeEntity node;

    @Column(columnDefinition = "BYTEA")
    public byte[] data;

    @Column(nullable = false)
    public int hash;

    public FingerprintEntity() {}

    public FingerprintEntity(FolderEntity folder, NodeEntity node, byte[] data) {
        this.folder = folder;
        this.node = node;
        this.data = data;
        this.hash = Arrays.hashCode(data);
    }

    /**
     * Find an existing fingerprint or create a new one.
     */
    public static FingerprintEntity findOrCreate(EntityManager em,
                                                  FolderEntity folder, NodeEntity node, byte[] data) {
        int hash = Arrays.hashCode(data);
        FingerprintEntity existing = FingerprintEntity.find(
                "folder.id = ?1 and node.id = ?2 and hash = ?3",
                folder.id, node.id, hash).firstResult();
        if (existing != null && Arrays.equals(existing.data, data)) {
            return existing;
        }
        // Hash collision or new fingerprint — create
        FingerprintEntity fp = new FingerprintEntity(folder, node, data);
        em.persist(fp);
        return fp;
    }
}
