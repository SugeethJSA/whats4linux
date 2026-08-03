package common

import (
	"fmt"
	"strings"

	"github.com/urfave/cli"
)

// VersionCmdStr holds the formatted version string displayed by the version command.
// It is populated at runtime by the Execute function with build-time information
// including version, platform, build date, and commit hash.
var VersionCmdStr string

var (
	showAppHelpAndExit = cli.ShowAppHelpAndExit
	showCommandHelp    = cli.ShowCommandHelp
)

// Help displays help information for the application or a specific command.
// If no argument is provided or the argument is "help", it displays the
// application-level help and exits. Otherwise, it shows help for the
// specified command name.
func Help(ctx *cli.Context) error {
	arg := ctx.Args().First()
	if arg == "" || arg == "help" {
		fmt.Printf("%s %s\n", ctx.App.Name, ctx.App.Version)
		showAppHelpAndExit(ctx, 0)
		return nil
	}
	err := showCommandHelp(ctx, arg)
	if err != nil {
		return err
	}
	err = PrintErrWithHelp(ctx, err)
	if err != nil {
		return err
	}
	return nil
}

// GetVersion prints the version string to stdout and returns nil.
// The version string includes the application name, version, platform,
// build date, and commit hash as configured in VersionCmdStr.
func GetVersion(_ *cli.Context) error {
	fmt.Println(VersionCmdStr)
	return nil
}

// PrintErrWithCmdHelp prints the error message followed by the current
// command's help text. It is used for errors that occur in the context
// of a specific subcommand.
func PrintErrWithCmdHelp(ctx *cli.Context, err error) error {
	return printErrWithCallback(
		ctx,
		err,
		func() {
			err := showCommandHelp(ctx, ctx.Command.Name)
			if err != nil {
				fmt.Println(err.Error())
			}
		},
	)
}

// PrintErrWithHelp prints the error message followed by the application-level
// help text and exits with status code 1. It is used for errors that occur
// at the application level rather than within a specific command.
func PrintErrWithHelp(ctx *cli.Context, err error) error {
	return printErrWithCallback(
		ctx,
		err,
		func() {
			showAppHelpAndExit(ctx, 1)
		},
	)
}

func printErrWithCallback(ctx *cli.Context, err error, callback func()) error {
	if err == nil {
		return nil
	}
	estr := strings.ToLower(err.Error())
	if estr == "flag: help requested" {
		return Help(ctx)
	}
	if strings.Contains(estr, "-version") ||
		strings.Contains(estr, "-v") {
		return GetVersion(ctx)
	}
	fmt.Printf("%s: %s\n\n", ctx.App.HelpName, err.Error())
	callback()
	return nil
}

// UsageErrorCallback handles usage errors from the CLI framework.
// It determines whether the error occurred at the command level or
// application level and displays the appropriate help text along with
// the error message. This function is designed to be used as the
// OnUsageError callback for cli.App and cli.Command.
func UsageErrorCallback(ctx *cli.Context, err error, _ bool) error {
	if ctx.Command.Name != "" {
		return PrintErrWithCmdHelp(ctx, err)
	}
	return PrintErrWithHelp(ctx, err)
}
