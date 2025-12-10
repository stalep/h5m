package exp.command.aesh;

import exp.entity.Folder;
import exp.entity.NodeGroup;
import exp.svc.FolderService;
import exp.svc.NodeGroupService;
import jakarta.enterprise.inject.spi.CDI;
import org.aesh.command.Command;
import org.aesh.command.CommandDefinition;
import org.aesh.command.CommandException;
import org.aesh.command.CommandResult;
import org.aesh.command.invocation.CommandInvocation;
import org.aesh.command.option.Option;

import java.nio.file.Paths;

@CommandDefinition(generateHelp = true, name = "folder", description = "adding a folder")
public class AddFolderCommand implements Command {

    @Option(askIfNotSet = true, description = "folder name")
    private String name;

    @Option(askIfNotSet = true, description = "folder")
    private String folder;

    @Override
    public CommandResult execute(CommandInvocation ci) throws CommandException, InterruptedException {

        FolderService folderService = CDI.current().select(FolderService.class).get();
        NodeGroupService nodeGroupService = CDI.current().select(NodeGroupService.class).get();
        if(name == null){
            ci.print("Enter name: ");
            name = ci.getShell().readLine();
        }
        if(folder == null){
            ci.print("Enter path: ");
            folder = ci.getShell().readLine();
        }
        if(".".equals(folder) || "./".equals(folder)){
            folder = Paths.get(".").toAbsolutePath().normalize().toString();
        }
        Folder existing = folderService.byName(folder);
        if(existing != null){
            ci.println(name+" already exists");
            return CommandResult.FAILURE;
        }
        existing = folderService.byPath(folder);
        if(existing != null){
            ci.println(existing.name+" already exists for "+folder);
            return CommandResult.FAILURE;
        }
        NodeGroup existingGroup =  nodeGroupService.byName(folder);
        if(existingGroup != null){
            ci.println(name+" conflicts with an existing node group");
            return CommandResult.FAILURE;
        }
        Folder newFolder = new Folder(name,folder);
        folderService.create(newFolder);

        return CommandResult.SUCCESS;
    }
}
