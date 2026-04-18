pub mod ai;
pub mod feedback;
pub mod files;
pub mod search;

pub use ai::{generate_ai_regex, stream_ai_chat, test_ai_connection};
pub use feedback::submit_feedback;
pub use files::{get_file_stats, read_file, scan_directory};
pub use search::search_in_files;
