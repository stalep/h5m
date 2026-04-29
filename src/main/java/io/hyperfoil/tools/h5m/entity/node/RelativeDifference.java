package io.hyperfoil.tools.h5m.entity.node;

import io.hyperfoil.tools.h5m.api.NodeType;
import io.hyperfoil.tools.h5m.entity.NodeEntity;
import io.hyperfoil.tools.yaup.json.Json;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Transient;

import java.util.ArrayList;
import java.util.List;

@Entity
@DiscriminatorValue("rd")
public class RelativeDifference extends NodeEntity implements DetectionNode {

    private static final String THRESHOLD = "threshold";
    public static final double DEFAULT_THRESHOLD = 0.2;
    private static final String WINDOW = "window";
    public static final int DEFAULT_WINDOW = 1;
    private static final String MIN_PREVIOUS = "minPrevious";
    public static final int DEFAULT_MIN_PREVIOUS = 5;
    private static final String FILTER =  "filter";
    public static final String DEFAULT_FILTER = "mean";//attribute value must be a constant
    private static final String FINGERPRINT_FILTER = "fingerprintFilter";

    @Transient
    private Json config;

    public RelativeDifference() {
        config = new Json();
    }

    public RelativeDifference(String name, String operation) {
        super(name,operation);
        config = new Json();
    }

    @Override
    public NodeType type() {
        return NodeType.RELATIVE_DIFFERENCE;
    }

    @PostLoad
    public void loadConfig(){
        if(this.config == null || this.config.isEmpty()){
            if(this.operation!=null && !this.operation.isBlank()){
                config = Json.fromString(this.operation);
            }else {
                config = new Json();
                //TODO load default values?
            }
        }
    }

    private static final String FINGERPRINT_NODE_ID = "fingerprintNodeId";
    private static final String GROUP_BY_NODE_ID = "groupByNodeId";
    private static final String RANGE_NODE_ID = "rangeNodeId";
    private static final String DOMAIN_NODE_ID = "domainNodeId";

    public void setNodes(NodeEntity fingerprint, NodeEntity groupBy, NodeEntity range, NodeEntity domain){
        List<NodeEntity> sources = new ArrayList<>();
        sources.add(fingerprint);
        sources.add(groupBy);
        sources.add(range);
        if(domain!=null){
            sources.add(domain);
        }
        this.sources = sources;
        config.set(FINGERPRINT_NODE_ID, fingerprint.id);
        config.set(GROUP_BY_NODE_ID, groupBy.id);
        config.set(RANGE_NODE_ID, range.id);
        if(domain != null){
            config.set(DOMAIN_NODE_ID, domain.id);
        }
        operation = config.toString();
    }

    private NodeEntity findSourceById(String configKey){
        long nodeId = config.getLong(configKey);
        return sources.stream().filter(s -> s.id == nodeId).findFirst().orElse(null);
    }

    @Transient
    public NodeEntity getRangeNode(){
        if(config.has(RANGE_NODE_ID)){
            return findSourceById(RANGE_NODE_ID);
        }
        return sources.get(2);
    }

    @Transient
    public NodeEntity getDomainNode(){
        if(config.has(DOMAIN_NODE_ID)){
            return findSourceById(DOMAIN_NODE_ID);
        }
        return sources.size() > 3 ? sources.get(3) : null;
    }

    @Transient
    public NodeEntity getGroupByNode(){
        if(config.has(GROUP_BY_NODE_ID)){
            return findSourceById(GROUP_BY_NODE_ID);
        }
        return sources.get(1);
    }

    @Transient
    public NodeEntity getFingerprintNode(){
        if(config.has(FINGERPRINT_NODE_ID)){
            return findSourceById(FINGERPRINT_NODE_ID);
        }
        return sources.get(0);
    }

    @Transient
    public List<NodeEntity> getFingerprintNodes(){
        NodeEntity fp = getFingerprintNode();
        return fp != null ? fp.sources : List.of();
    }


    @Transient
    public double getThreshold(){
        return config.getDouble(THRESHOLD,DEFAULT_THRESHOLD);
    }
    public void setThreshold(double threshold){
        config.set(THRESHOLD,threshold);
        operation=config.toString();
    }
    @Transient
    public long getWindow(){
        return config.getLong(WINDOW,DEFAULT_WINDOW);
    }
    public void setWindow(long window){
        config.set(WINDOW,window);
        operation=config.toString();
    }
    @Transient
    public long getMinPrevious(){
        return config.getLong(MIN_PREVIOUS,DEFAULT_MIN_PREVIOUS);
    }
    public void setMinPrevious(long minPrevious){
        config.set(MIN_PREVIOUS,minPrevious);
        operation=config.toString();
    }
    @Transient
    public String getFilter(){
        return config.getString(FILTER);
    }
    public void setFilter(String filter){
        config.set(FILTER,filter);
        operation=config.toString();
    }
    @Transient
    public String getFingerprintFilter(){
        return config.getString(FINGERPRINT_FILTER);
    }
    public void setFingerprintFilter(String fingerprintFilter){
        config.set(FINGERPRINT_FILTER,fingerprintFilter);
        operation=config.toString();
    }

    @Override
    protected NodeEntity shallowCopy() {
        return new RelativeDifference(name,operation);
    }

}
