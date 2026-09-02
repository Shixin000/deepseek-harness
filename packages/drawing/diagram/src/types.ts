/** Public type subpath for the diagram Remote boundary (typert contract). */

/** Save request: the workspace path (absolute or backend-default cwd) and the serialized scene. */
export interface DiagramSaveRequest {
  /** Output path, resolved against the backend cwd; must end with .excalidraw. */
  path: string
  /** Full serialized `.excalidraw` document text. */
  content: string
  /** Owning session for the log-only `diagram/saved` event; omitted skips the event. */
  sessionId?: string
}

/** Read request: the workspace path to load. */
export interface DiagramReadRequest {
  /** Input path, resolved against the backend cwd; must end with .excalidraw. */
  path: string
}

/** Successful save outcome. */
export interface DiagramSaveOk {
  ok: true
  /** Resolved display path of the written file. */
  path: string
  /** Bytes written. */
  bytes: number
}

/** Successful read outcome. */
export interface DiagramReadOk {
  ok: true
  /** Resolved display path of the read file. */
  path: string
  /** Document text, at most the bounded read cap. */
  content: string
  /** Bytes read. */
  bytes: number
}

/** Explicit business failure (path/size policy), never a transport throw. */
export interface DiagramRemoteFailure {
  ok: false
  code: 'invalid-path' | 'write-failed' | 'read-failed'
  message: string
}

/** Save result union. */
export type DiagramSaveResult = DiagramSaveOk | DiagramRemoteFailure

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** One canvas save through the diagram Remote; log-only UI state, never derived history. */
    'diagram/saved': {
      /** Workspace path written. */
      path: string
      /** Number of elements in the saved scene. */
      elementCount: number
    }
  }
}

/** Read result union. */
export type DiagramReadResult = DiagramReadOk | DiagramRemoteFailure
