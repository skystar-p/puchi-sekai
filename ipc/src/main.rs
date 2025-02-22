use puchi_sekai_common::IPCEvent;
use tracing::debug;
use zeromq::{Socket, SocketSend};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    debug!("connecting to ipc");

    let mut socket = zeromq::ReqSocket::new();
    socket.connect("ipc:///tmp/puchi-sekai").await?;

    debug!("connected");

    let event = IPCEvent::MainToggle;
    let event_serialized = serde_json::to_string(&event)?;

    socket.send(event_serialized.into()).await?;
    debug!("successfully sent event");

    Ok(())
}
