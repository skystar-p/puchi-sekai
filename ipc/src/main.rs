use clap::{Parser, Subcommand};
use puchi_sekai_common::IPCEvent;
use tracing::debug;
use zeromq::{Socket, SocketSend};

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

    let socket_path = cli.socket.unwrap_or_else(|| "ipc:///tmp/puchi-sekai".into());

    // check socket exists if starts with ipc://
    if socket_path.starts_with("ipc://") {
        let socket_path = socket_path.replace("ipc://", "");
        if !std::path::Path::new(&socket_path).exists() {
            anyhow::bail!("socket path does not exist");
        }
    }

    debug!("connecting to ipc");
    let mut socket = zeromq::ReqSocket::new();
    socket.connect(&socket_path).await?;

    debug!("connected");

    let cmd = cli.command.unwrap_or(Commands::MainToggle);

    let event = match cmd {
        Commands::MainToggle => {
            debug!("toggling main");
            IPCEvent::MainToggle
        }

        Commands::OpenModal => IPCEvent::OpenModal,
    };

    let event_serialized = serde_json::to_string(&event)?;

    socket.send(event_serialized.into()).await?;
    debug!("successfully sent event");

    Ok(())
}
