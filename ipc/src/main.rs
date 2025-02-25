use clap::{Parser, Subcommand};
use ipc_lib::send_ipc;
use puchi_sekai_common::IPCEvent;
use tracing::debug;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    /// Sets a custom config file
    #[arg(short, long, value_name = "SOCKET")]
    socket: Option<String>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    MainToggle,
    OpenModal,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    let socket_path = cli
        .socket
        .unwrap_or_else(|| "ipc:///tmp/puchi-sekai".into());

    let cmd = cli.command.unwrap_or(Commands::MainToggle);

    let event = match cmd {
        Commands::MainToggle => {
            debug!("toggling main");
            IPCEvent::MainToggle
        }

        Commands::OpenModal => {
            debug!("opening modal");
            IPCEvent::OpenModal
        }
    };

    send_ipc(socket_path, event).await?;

    Ok(())
}
