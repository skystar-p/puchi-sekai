use puchi_sekai_lib::IPCEvent;
use zeromq::{Socket, SocketSend};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut socket = zeromq::ReqSocket::new();
    socket
        .connect("ipc:///tmp/puchi-sekai-ipc")
        .await
        .expect("Failed to connect");

    let event = IPCEvent {};
    let event_serialized = serde_json::to_string(&event)?;

    socket.send(event_serialized.into()).await?;

    Ok(())
}
