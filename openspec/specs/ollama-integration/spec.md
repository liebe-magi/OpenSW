# ollama-integration Specification

## Purpose

TBD - created by archiving change integrate-ollama-clipboard. Update Purpose after archive.

## Requirements

### Requirement: Fetch Available Models

The system MUST be able to retrieve a list of available LLM models from the local Ollama instance.

#### Scenario: Successfully fetch models

- **WHEN** the application requests available models
- **THEN** it should receive a list containing `llama3` and `gemma2` (given Ollama is running with these models)

#### Scenario: Ollama not running

- **WHEN** the application requests available models
- **THEN** it should return a connection error indicating Ollama is unavailable
