package exp.command.aesh;

import exp.command.H5m;
import exp.entity.Node;
import exp.entity.NodeGroup;
import exp.entity.node.JqNode;
import exp.svc.FolderService;
import exp.svc.NodeGroupService;
import exp.svc.NodeService;
import jakarta.enterprise.inject.spi.CDI;
import org.aesh.command.Command;
import org.aesh.command.CommandDefinition;
import org.aesh.command.CommandException;
import org.aesh.command.CommandResult;
import org.aesh.command.invocation.CommandInvocation;
import org.aesh.command.option.Option;

@CommandDefinition(name = "jq", description = "add jq node")
public class AddJqCommand implements Command {

    @Option(askIfNotSet = true, description = "node name")
    private String name;

    @Option(askIfNotSet = true, description = "target group / test")
    private String groupName;

    @Option(askIfNotSet = true, description = "jq filter")
    private String jq;

    @Override
    public CommandResult execute(CommandInvocation ci) throws CommandException, InterruptedException {

        NodeGroupService nodeGroupService = CDI.current().select(NodeGroupService.class).get();
        NodeService nodeService = CDI.current().select(NodeService.class).get();

        if(name == null) {
            ci.print("Enter name: ");
            name = ci.getShell().readLine();
        }
        NodeGroup foundGroup = null;
        do{
            if(groupName == null ) {
                ci.print("Enter target group / folder name: ");
                groupName = ci.getShell().readLine();
            }
            foundGroup =  nodeGroupService.byName(groupName);
            if(foundGroup == null){
                ci.println("could not find "+groupName);
                groupName = null;
            }
        }while(groupName == null);

        if(jq == null ){
            ci.print("Enter jq filter: ");
            jq = ci.getShell().readLine();
        }
        NodeGroup staticFoundGroup = foundGroup;
        Node node = JqNode.parse(name,jq, n->nodeService.findNodeByFqdn(n,staticFoundGroup.id));
        if(node == null){
            ci.println("cannot create node from jq="+jq);
            return CommandResult.FAILURE;
        }
        node.group=foundGroup;
        if(node.sources.isEmpty()){
            node.sources.add(foundGroup.root);
        }
        long response = nodeService.create(node);
        if(response < 0 ){
            return CommandResult.FAILURE;
        }

        return CommandResult.SUCCESS;
    }
}
