use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IPCEvent {
    MainToggle,
    ModalToggle,
}
