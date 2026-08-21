package io.hyperfoil.tools.h5m.cli;

import org.aesh.command.Command;
import org.aesh.command.CommandDefinition;
import org.aesh.command.CommandResult;

@CommandDefinition(
    name = "apikey",
    description = "API key management",
    groupCommands = {
        AdminCreateApiKey.class,
        AdminListApiKeys.class,
        AdminRevokeApiKey.class,
    },
    generateHelp = true
)
public class UserApiKeyCmd implements Command<H5mCommandInvocation> {
    @Override
    public CommandResult execute(H5mCommandInvocation invocation) {
        invocation.println("Use 'user apikey <subcommand>'. Try 'user apikey --help' for available subcommands.");
        return CommandResult.SUCCESS;
    }
}
