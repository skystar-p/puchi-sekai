use puchi_sekai_common::IPCEvent;
use zeromq::{Socket, SocketSend};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Connecting");
    let mut socket = zeromq::ReqSocket::new();
    socket
        .connect("ipc:///tmp/puchi-sekai")
        .await
        .expect("Failed to connect");

    println!("Connected");

    let event = IPCEvent {};
    let event_serialized = serde_json::to_string(&event)?;

    socket.send(event_serialized.into()).await?;
    println!("Sent");

    Ok(())
}
