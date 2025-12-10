package exp.command.aesh;

import org.aesh.command.Command;
import org.aesh.command.CommandException;
import org.aesh.command.CommandResult;
import org.aesh.command.GroupCommandDefinition;
import org.aesh.command.invocation.CommandInvocation;
import org.aesh.command.option.Option;

@GroupCommandDefinition(name = "add", description = "Adding stuff", groupCommands = {AddFolderCommand.class, AddJqCommand.class})
public class AddCommand implements Command {

    @Option(hasValue = false, description = "display this help option")
    private boolean help;

    @Override
    public CommandResult execute(CommandInvocation ci) throws CommandException, InterruptedException {
        if(help) {
            ci.getShell().writeln(ci.getHelpInfo());
        } else {
            ci.getShell().writeln("only executed add, it doesnt do much...");
        }

        return CommandResult.SUCCESS;
    }
}
