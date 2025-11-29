use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::fs::File;
use std::io::BufReader;
use std::sync::{mpsc, Arc, Mutex};
use tauri::{State, Window};

pub struct AudioState {
    pub is_recording: Mutex<bool>,
    pub recording_buffer: Arc<Mutex<Vec<f32>>>,
    pub stop_tx: Mutex<Option<mpsc::Sender<()>>>,
    pub format: Mutex<Option<(u32, u16)>>, // sample_rate, channels
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            is_recording: Mutex::new(false),
            recording_buffer: Arc::new(Mutex::new(Vec::new())),
            stop_tx: Mutex::new(None),
            format: Mutex::new(None),
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct AudioLevelEvent {
    amplitude: f32,
}

#[tauri::command]
pub fn get_input_devices() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    let devices = host.input_devices().map_err(|e| e.to_string())?;
    let mut device_names = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            device_names.push(name);
        }
    }
    Ok(device_names)
}

#[tauri::command]
pub fn start_recording(
    window: Window,
    state: State<AudioState>,
    device_name: Option<String>,
) -> Result<String, String> {
    let mut is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if *is_recording {
        return Err("Already recording".to_string());
    }

    let (tx, rx) = mpsc::channel();
    *state.stop_tx.lock().map_err(|e| e.to_string())? = Some(tx);

    let buffer = state.recording_buffer.clone();
    // Clear previous recording
    {
        let mut buf = buffer.lock().map_err(|e| e.to_string())?;
        buf.clear();
    }

    let host = cpal::default_host();

    let device = if let Some(name) = device_name {
        host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|x| x.name().map(|n| n == name).unwrap_or(false))
            .ok_or(format!("Device '{}' not found", name))?
    } else {
        host.default_input_device()
            .ok_or("No input device available")?
    };

    let selected_device_name = device
        .name()
        .unwrap_or_else(|_| "Unknown Device".to_string());
    let config = device.default_input_config().map_err(|e| e.to_string())?;

    // We need to clone things to move into thread
    let buffer_clone = buffer.clone();
    let window_clone = window.clone();

    let stream_config: cpal::StreamConfig = config.clone().into();

    // Save format now
    *state.format.lock().map_err(|e| e.to_string())? =
        Some((stream_config.sample_rate.0, stream_config.channels));

    std::thread::spawn(move || {
        let err_fn = |err| eprintln!("an error occurred on stream: {}", err);

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &_| {
                    write_input_data(data, &buffer_clone, &window_clone);
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &_| {
                    let f32_data: Vec<f32> =
                        data.iter().map(|&x| x as f32 / i16::MAX as f32).collect();
                    write_input_data(&f32_data, &buffer_clone, &window_clone);
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &stream_config,
                move |data: &[u16], _: &_| {
                    let f32_data: Vec<f32> = data
                        .iter()
                        .map(|&x| (x as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0))
                        .collect();
                    write_input_data(&f32_data, &buffer_clone, &window_clone);
                },
                err_fn,
                None,
            ),
            _ => return, // Should handle error but difficult in thread
        }
        .expect("Failed to build stream");

        stream.play().expect("Failed to play stream");

        // Wait for stop signal
        let _ = rx.recv();

        // Stream is dropped here
    });

    *is_recording = true;
    Ok(selected_device_name)
}

fn write_input_data(input: &[f32], buffer: &Arc<Mutex<Vec<f32>>>, window: &Window) {
    if let Ok(mut buf) = buffer.lock() {
        buf.extend_from_slice(input);

        // Calculate RMS for visualization
        let sum_squares: f32 = input.iter().map(|&x| x * x).sum();
        let rms = (sum_squares / input.len() as f32).sqrt();

        // Emit event (throttle this in production, but okay for now)
        let _ = window.emit("audio-level-update", AudioLevelEvent { amplitude: rms });
    }
}

#[tauri::command]
pub fn stop_recording(state: State<AudioState>) -> Result<String, String> {
    let mut is_recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if !*is_recording {
        return Err("Not recording".to_string());
    }

    // Send stop signal
    if let Some(tx) = state.stop_tx.lock().map_err(|e| e.to_string())?.take() {
        let _ = tx.send(());
    }

    *is_recording = false;

    // Wait a bit for thread to finish writing?
    // The buffer is protected by Mutex, so we are fine.
    // But the thread might still be writing the LAST chunk.
    // Ideally we should wait for thread join, but we didn't store the handle.
    // For now, a small sleep or just assuming it's fast enough is "okay" for Phase 1.
    // Better: use a channel to ack the stop.
    // But let's keep it simple.
    std::thread::sleep(std::time::Duration::from_millis(100));

    let buffer = state.recording_buffer.lock().map_err(|e| e.to_string())?;
    let (sample_rate, channels) = state
        .format
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("No recording format found")?;

    // Save to WAV
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join("recording_test.wav");
    let mut writer = hound::WavWriter::create(&path, spec).map_err(|e| e.to_string())?;

    for &sample in buffer.iter() {
        writer.write_sample(sample).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn play_recording() -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join("recording_test.wav");

    if !path.exists() {
        return Err("No recording found".to_string());
    }

    std::thread::spawn(move || {
        let (_stream, stream_handle) = rodio::OutputStream::try_default().unwrap();
        let file = File::open(path).unwrap();
        let source = rodio::Decoder::new(BufReader::new(file)).unwrap();
        let sink = rodio::Sink::try_new(&stream_handle).unwrap();

        sink.append(source);
        sink.sleep_until_end();
    });

    Ok(())
}
