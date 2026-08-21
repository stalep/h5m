package io.hyperfoil.tools.h5m.cli;

import org.aesh.command.Command;
import org.aesh.command.CommandDefinition;
import org.aesh.command.CommandResult;

@CommandDefinition(
    name = "user",
    description = "User management",
    groupCommands = {
        AdminCreateUser.class,
        AdminListUsers.class,
        UserApiKeyCmd.class,
    },
    generateHelp = true
)
public class UserCmd implements Command<H5mCommandInvocation> {
    @Override
    public CommandResult execute(H5mCommandInvocation invocation) {
        invocation.println("Use 'user <subcommand>'. Try 'user --help' for available subcommands.");
        return CommandResult.SUCCESS;
    }
}
