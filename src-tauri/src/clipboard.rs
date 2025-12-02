use arboard::Clipboard;
use std::error::Error;

pub fn copy_text(text: &str) -> Result<(), Box<dyn Error>> {
    let mut clipboard = Clipboard::new()?;
    clipboard.set_text(text)?;
    Ok(())
}
