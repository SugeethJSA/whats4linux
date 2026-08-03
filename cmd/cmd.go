package cmd

import (
	"fmt"
	"io/fs"
	"runtime"

	"github.com/lugvitc/whats4linux/cmd/common"
	"github.com/urfave/cli"
)

const AppName = "whats4linux"

// BuildArgs contains build-time information passed to the CLI application.
// These values are typically injected during the build process via ldflags
// and are used to display version and build information to users.
type BuildArgs struct {
	// Version is the semantic version of the application.
	Version string
	// BuildType indicates the build variant (e.g., "release", "debug", "snapshot").
	BuildType string
	// Date is the build timestamp in a human-readable format.
	Date string
	// Commit is the git commit hash from which the build was created.
	Commit string
}

func GetApp(assets fs.FS, bArgs BuildArgs) *cli.App {
	// Build the base commands
	commands := []cli.Command{
		{
			Name:    "help",
			Aliases: []string{"h"},
			Usage:   "prints the help message",
			Action:  common.Help,
		},
		{
			Name:               "version",
			Aliases:            []string{"v"},
			Usage:              "prints installed version",
			UsageText:          " ",
			CustomHelpTemplate: CommandHelpTempl,
			Action:             common.GetVersion,
		},
	}

	return &cli.App{
		Name:                   AppName,
		HelpName:               AppName,
		Usage:                  "An unofficial WhatsApp client.",
		Version:                fmt.Sprintf("%s-%s", bArgs.Version, bArgs.BuildType),
		UsageText:              "whats4linux <command> [arguments...]",
		Description:            DESCRIPTION,
		CustomAppHelpTemplate:  HelpTempl,
		OnUsageError:           common.UsageErrorCallback,
		Commands:               commands,
		Action:                 run(assets),
		UseShortOptionHandling: true,
		HideHelp:               true,
		HideVersion:            true,
	}
}

func Execute(args []string, assets fs.FS, bArgs BuildArgs) error {
	// Get the configured CLI application
	app := GetApp(assets, bArgs)

	// Set the version command string for global use
	common.VersionCmdStr = fmt.Sprintf("%s %s (%s_%s)\n",
		app.Name,
		app.Version,
		runtime.GOOS,
		runtime.GOARCH,
	)

	if bArgs.Commit != "" && bArgs.Date != "" {
		common.VersionCmdStr += fmt.Sprintf("Build: %s=%s\n", bArgs.Date, bArgs.Commit)
	}

	return app.Run(args)
}
