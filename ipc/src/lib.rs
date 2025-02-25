use puchi_sekai_common::IPCEvent;
use tracing::debug;
use zeromq::{Socket, SocketSend};

pub async fn send_ipc(socket_path: impl AsRef<str>, event: IPCEvent) -> anyhow::Result<()> {
    let socket_path = socket_path.as_ref();

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

    let event_serialized = serde_json::to_string(&event)?;

    socket.send(event_serialized.into()).await?;
    debug!("successfully sent event");

    Ok(())
}
