package io.hyperfoil.tools.h5m.cli;

import io.hyperfoil.tools.h5m.api.Team;
import io.hyperfoil.tools.h5m.api.svc.TeamServiceInterface;
import jakarta.inject.Inject;

import org.aesh.command.Command;
import org.aesh.command.CommandDefinition;
import org.aesh.command.CommandResult;
import org.aesh.command.option.Argument;

@CommandDefinition(name = "add", description = "Create a new team for organizing access control", generateHelp = true)
public class AdminCreateTeam implements Command<H5mCommandInvocation> {

    @Inject
    TeamServiceInterface teamService;

    @Argument(description = "team name", required = true, validator = ReservedNamespaceValidator.class)
    public String name;

    @Override
    public CommandResult execute(H5mCommandInvocation invocation) throws InterruptedException {
        Team team = teamService.create(name);
        invocation.println("Created team: " + name + " (id=" + team.id() + ")");
        return CommandResult.SUCCESS;
    }
}
