# Argus Agent — Autonomous AI Executive Assistant for Android

Argus is an **agentic Android executive assistant** designed to move beyond conversational AI and actively execute tasks on a user’s behalf.

Built with **React Native, Expo, TypeScript, and Google Gemini**, Argus combines multi-turn reasoning with device capabilities, contextual memory, automation primitives, and event-driven workflows to create an assistant that can **observe context, make decisions, and take action** rather than simply return text.

### Core Capabilities

* **Agentic AI orchestration** — Multi-turn Gemini-powered reasoning designed around task execution rather than simple chat.
* **Android automation** — Integrates device-level capabilities and RPA-style interaction to enable actions beyond the application itself.
* **Contextual & semantic memory** — Maintains user context across interactions to support more persistent, personalized assistance.
* **Financial intelligence** — Detects and processes Nigerian banking transaction SMS messages to automatically maintain a **Naira-based financial ledger**.
* **Location-aware automation** — Uses geofencing and contextual triggers to initiate habit-stacking and proactive workflows.
* **Executive dashboard** — Surfaces activity, readiness, telemetry, financial state, and autonomous actions through a unified mobile interface.
* **Secure local storage** — Uses platform security primitives and local persistence for sensitive application state.
* **Authentication & device integration** — Leverages Android capabilities including biometric authentication, location services, calendar integration, speech, and background task execution.

### Architecture

Argus is structured as a modular React Native application with **Expo Router**, Zustand-based state management, SQLite persistence, secure storage, and dedicated UI components for conversational and autonomous workflows.

The architecture is intentionally designed around the distinction between:

**Intent → Reasoning → Context → Tool/Device Action → Feedback**

This allows Argus to evolve from a conventional chatbot into a more capable **personal agent runtime** capable of coordinating AI reasoning with real-world device state and actions.

### Technology Stack

* **TypeScript**
* **React Native**
* **Expo 57**
* **Expo Router**
* **Google Gemini API**
* **Zustand**
* **SQLite**
* **Expo Secure Store**
* **Expo Location & Task Manager**
* **Expo Calendar**
* **Expo Local Authentication**
* **React Native Reanimated**

### Why Argus?

Most personal assistants stop at generating an answer.

Argus is built around a different premise:

> **An executive assistant should not only tell you what to do — it should be capable of doing it.**

The project explores the engineering challenges involved in building **persistent, context-aware, device-integrated AI agents** that can operate across conversations, application state, environmental signals, and real-world actions.

Argus is an experimental platform for exploring the intersection of **LLM agents, mobile computing, automation, memory systems, and autonomous task execution**.
