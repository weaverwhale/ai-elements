import { z } from 'zod';
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import hnswlib from 'hnswlib-node';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Define the data directory for vector store
const VECTOR_DATA_DIR = path.join(process.cwd(), 'vector-store');
const VECTOR_STORE_DIR = path.join(VECTOR_DATA_DIR, 'vectors');
const DOCUMENTS_DIR = path.join(VECTOR_DATA_DIR, 'documents');
const VECTOR_METADATA_PATH = path.join(VECTOR_DATA_DIR, 'metadata.json');
const VECTOR_DIM = 384; // Dimension for the MiniLM model

// Ensure data directories exist
if (!fs.existsSync(VECTOR_DATA_DIR)) {
  fs.mkdirSync(VECTOR_DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// Initialize vector index for documents
let documentVectorIndex: InstanceType<typeof hnswlib.HierarchicalNSW>;
const documentIndexPath = path.join(VECTOR_STORE_DIR, 'document_index.bin');

function initDocumentVectorIndex() {
  if (fs.existsSync(documentIndexPath)) {
    // Load existing index
    documentVectorIndex = new hnswlib.HierarchicalNSW('l2', VECTOR_DIM);
    // @ts-ignore - Method missing in type definitions
    documentVectorIndex.readIndex(documentIndexPath);
    console.log('[VECTOR_STORE] Loaded existing document vector index');
  } else {
    // Create new index
    documentVectorIndex = new hnswlib.HierarchicalNSW('l2', VECTOR_DIM);
    documentVectorIndex.initIndex(10000); // Max elements
    console.log('[VECTOR_STORE] Created new document vector index');
  }
}

// Define interfaces for document data
interface DocumentData {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  filePath: string;
  content: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  similarity?: number;
  chunkIndex?: number;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  startPosition: number;
  endPosition: number;
}

// Enhanced metadata to store document content and chunks
interface DocumentMetadata {
  count: number;
  userDocuments: Record<string, string[]>;
  documents: Record<string, DocumentData>;
  chunks: Record<string, DocumentChunk>;
  chunkToIndex: Record<string, number>; // Maps chunk ID to vector index
}

// Load or create metadata
let documentMetadata: DocumentMetadata = {
  count: 0,
  userDocuments: {},
  documents: {},
  chunks: {},
  chunkToIndex: {},
};

function loadDocumentMetadata() {
  if (fs.existsSync(VECTOR_METADATA_PATH)) {
    try {
      const data = fs.readFileSync(VECTOR_METADATA_PATH, 'utf8');
      documentMetadata = JSON.parse(data);
      console.log(
        '[VECTOR_STORE] Loaded metadata, document count:',
        Object.keys(documentMetadata.documents).length,
      );

      // Initialize missing properties for backward compatibility
      if (!documentMetadata.chunks) {
        documentMetadata.chunks = {};
      }
      if (!documentMetadata.chunkToIndex) {
        documentMetadata.chunkToIndex = {};
      }
      if (typeof documentMetadata.count === 'undefined') {
        documentMetadata.count = 0;
      }
      saveDocumentMetadata();
    } catch (error) {
      console.error('[VECTOR_STORE] Error loading metadata:', error);
      documentMetadata = {
        count: 0,
        userDocuments: {},
        documents: {},
        chunks: {},
        chunkToIndex: {},
      };
    }
  } else {
    console.log('[VECTOR_STORE] No metadata found, starting fresh');
  }
}

function saveDocumentMetadata() {
  fs.writeFileSync(VECTOR_METADATA_PATH, JSON.stringify(documentMetadata, null, 2), 'utf8');
}

// Initialize embedding model
type Embedder = {
  (
    text: string,
    options: { pooling: 'none' | 'mean' | 'cls' | undefined; normalize: boolean },
  ): Promise<{ data?: unknown }>;
};
let documentEmbedder: Embedder | null = null;

async function getDocumentEmbedder() {
  if (!documentEmbedder) {
    console.log('[VECTOR_STORE] Initializing embedding model...');
    try {
      // Using the same model as memory for consistency
      documentEmbedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[VECTOR_STORE] Embedding model initialized');
    } catch (error) {
      console.error('[VECTOR_STORE] Error initializing embedding model:', error);
      return null;
    }
  }
  return documentEmbedder;
}

async function generateDocumentEmbedding(text: string): Promise<number[]> {
  const model = await getDocumentEmbedder();
  if (!model) {
    throw new Error('Document embedding model not initialized');
  }

  // @ts-ignore - Type definitions don't match runtime behavior
  const result = await model(text, { pooling: 'mean', normalize: true });

  // Convert Float32Array to regular array for compatibility
  // @ts-ignore - Type definitions don't match runtime behavior
  if (result && result.data) {
    // @ts-ignore - Type definitions don't match runtime behavior
    return Array.from(result.data);
  }

  throw new Error('Failed to generate document embedding');
}

// File parsing functions
async function parseTextFile(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf8');
}

async function parsePdfFile(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function parseDocxFile(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parseFile(filePath: string, fileType: string): Promise<string> {
  const extension = fileType.toLowerCase();

  switch (extension) {
    case '.txt':
    case '.md':
    case '.json':
    case '.csv':
    case '.log':
      return await parseTextFile(filePath);
    case '.pdf':
      return await parsePdfFile(filePath);
    case '.docx':
      return await parseDocxFile(filePath);
    default:
      // Try to parse as text for unknown file types
      try {
        return await parseTextFile(filePath);
      } catch (error) {
        throw new Error(`Unsupported file type: ${extension}`);
      }
  }
}

// Function to chunk text for better vector search
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}

// Store document function
async function storeDocument(
  userId: string,
  filePath: string,
  originalName: string,
  fileBuffer?: Buffer,
): Promise<string> {
  try {
    const documentId = crypto.randomUUID();
    const fileExtension = path.extname(originalName);
    const filename = `${documentId}${fileExtension}`;
    const savedFilePath = path.join(DOCUMENTS_DIR, filename);

    // Save file to documents directory
    if (fileBuffer) {
      fs.writeFileSync(savedFilePath, fileBuffer);
    } else if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, savedFilePath);
    } else {
      throw new Error('File not found and no buffer provided');
    }

    // Parse file content
    const content = await parseFile(savedFilePath, fileExtension);

    // Get file stats
    const stats = fs.statSync(savedFilePath);

    // Create document data
    const documentData: DocumentData = {
      id: documentId,
      userId,
      filename,
      originalName,
      filePath: savedFilePath,
      content,
      fileType: fileExtension,
      fileSize: stats.size,
      uploadedAt: new Date().toISOString(),
    };

    // Store document metadata
    documentMetadata.documents[documentId] = documentData;

    // Chunk the content for better search
    const chunks = chunkText(content);

    // Store chunks and generate embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${documentId}-chunk-${i}`;
      const chunk: DocumentChunk = {
        id: chunkId,
        documentId,
        content: chunks[i],
        chunkIndex: i,
        startPosition: i * 800, // Approximate position
        endPosition: Math.min((i + 1) * 800, content.length),
      };

      // Generate embedding for chunk
      const embedding = await generateDocumentEmbedding(chunks[i]);

      // Add to vector index
      // @ts-ignore - Types don't match, but it works at runtime
      documentVectorIndex.addPoint(embedding, documentMetadata.count);

      // Store chunk metadata
      documentMetadata.chunks[chunkId] = chunk;
      documentMetadata.chunkToIndex[chunkId] = documentMetadata.count;
      documentMetadata.count++;
    }

    // Update user documents mapping
    if (!documentMetadata.userDocuments[userId]) {
      documentMetadata.userDocuments[userId] = [];
    }
    documentMetadata.userDocuments[userId].push(documentId);

    // Save metadata
    saveDocumentMetadata();

    // Save the vector index periodically
    if (documentMetadata.count % 10 === 0) {
      // @ts-ignore - Method missing in type definitions
      documentVectorIndex.writeIndex(documentIndexPath);
    }

    console.log(
      `[VECTOR_STORE] Stored document ${documentId} for user ${userId} with ${chunks.length} chunks`,
    );
    return documentId;
  } catch (error) {
    console.error('[VECTOR_STORE] Error storing document:', error);
    throw error;
  }
}

// Search documents function
async function searchDocuments(
  userId: string,
  query: string,
  limit: number = 5,
): Promise<DocumentData[]> {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateDocumentEmbedding(query);

    // Search for similar embeddings
    const searchResults = documentVectorIndex.searchKnn(queryEmbedding, limit * 3);

    // Find relevant chunks and aggregate by document
    const documentScores: Record<
      string,
      { document: DocumentData; maxSimilarity: number; chunkCount: number }
    > = {};

    for (let i = 0; i < searchResults.neighbors.length; i++) {
      const vectorIndex = searchResults.neighbors[i];
      const similarity = 1 - searchResults.distances[i];

      // Find chunk by vector index
      const chunkId = Object.keys(documentMetadata.chunkToIndex).find(
        (id) => documentMetadata.chunkToIndex[id] === vectorIndex,
      );

      if (chunkId && documentMetadata.chunks[chunkId]) {
        const chunk = documentMetadata.chunks[chunkId];
        const document = documentMetadata.documents[chunk.documentId];

        // Only include documents for this user
        if (document && document.userId === userId) {
          if (!documentScores[chunk.documentId]) {
            documentScores[chunk.documentId] = {
              document: { ...document },
              maxSimilarity: similarity,
              chunkCount: 1,
            };
          } else {
            documentScores[chunk.documentId].maxSimilarity = Math.max(
              documentScores[chunk.documentId].maxSimilarity,
              similarity,
            );
            documentScores[chunk.documentId].chunkCount++;
          }
        }
      }
    }

    // Convert to array and sort by combined score
    const results = Object.values(documentScores)
      .map((item) => ({
        ...item.document,
        similarity: item.maxSimilarity + item.chunkCount * 0.1, // Bonus for multiple matching chunks
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);

    return results;
  } catch (error) {
    console.error('[VECTOR_STORE] Error searching documents:', error);
    return [];
  }
}

// List user documents
function listUserDocuments(userId: string): DocumentData[] {
  try {
    if (!documentMetadata.userDocuments[userId]) {
      return [];
    }

    return documentMetadata.userDocuments[userId]
      .map((docId) => documentMetadata.documents[docId])
      .filter(Boolean)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (error) {
    console.error('[VECTOR_STORE] Error listing user documents:', error);
    return [];
  }
}

// Delete document function
async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  try {
    const document = documentMetadata.documents[documentId];
    if (!document || document.userId !== userId) {
      console.error(`[VECTOR_STORE] Document ${documentId} not found or access denied`);
      return false;
    }

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Remove chunks from vector index
    const documentChunks = Object.values(documentMetadata.chunks).filter(
      (chunk) => chunk.documentId === documentId,
    );

    for (const chunk of documentChunks) {
      const vectorIndex = documentMetadata.chunkToIndex[chunk.id];
      if (typeof vectorIndex === 'number') {
        // @ts-ignore - Method missing in type definitions
        documentVectorIndex.markDelete(vectorIndex);
        delete documentMetadata.chunkToIndex[chunk.id];
      }
      delete documentMetadata.chunks[chunk.id];
    }

    // Remove from metadata
    delete documentMetadata.documents[documentId];

    // Remove from user documents
    if (documentMetadata.userDocuments[userId]) {
      documentMetadata.userDocuments[userId] = documentMetadata.userDocuments[userId].filter(
        (id) => id !== documentId,
      );
    }

    // Save metadata
    saveDocumentMetadata();

    // Save vector index
    // @ts-ignore - Method missing in type definitions
    documentVectorIndex.writeIndex(documentIndexPath);

    console.log(`[VECTOR_STORE] Deleted document ${documentId}`);
    return true;
  } catch (error) {
    console.error('[VECTOR_STORE] Error deleting document:', error);
    return false;
  }
}

// Initialize on startup
try {
  initDocumentVectorIndex();
  loadDocumentMetadata();
} catch (error) {
  console.error('[VECTOR_STORE] Error during initialization:', error);
}

// Define the parameter types
type VectorStoreParams = {
  operation: 'store' | 'search' | 'list' | 'delete';
  userId: string;
  filePath?: string;
  originalName?: string;
  fileBuffer?: Buffer;
  query?: string;
  documentId?: string;
  limit?: number;
};

const vectorStore = {
  id: 'vectorStore',
  name: 'Vector Store',
  description: 'Store, search, and manage documents (PDF, TXT, DOCX, etc.) using vector embeddings',
  inputSchema: z.object({
    operation: z
      .enum(['store', 'search', 'list', 'delete'])
      .describe(
        'Operation: store a document, search documents, list user documents, or delete a document',
      ),
    userId: z.string().describe('Unique identifier for the user'),
    filePath: z
      .string()
      .optional()
      .describe('Path to the file to store (required for store operation)'),
    originalName: z
      .string()
      .optional()
      .describe('Original filename (required for store operation)'),
    query: z.string().optional().describe('Search query (required for search operation)'),
    documentId: z
      .string()
      .optional()
      .describe('Document ID to delete (required for delete operation)'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of results to return when searching (default: 5)'),
  }),
  execute: async ({
    operation,
    userId,
    filePath,
    originalName,
    query,
    documentId,
    limit = 5,
  }: VectorStoreParams) => {
    console.log(`[VECTOR_STORE] Executing vector store tool with operation: ${operation}`);

    try {
      let storedDocId: string;
      let searchResults: DocumentData[];
      let userDocs: DocumentData[];
      let deleted: boolean;

      switch (operation) {
        case 'store':
          if (!filePath || !originalName) {
            return JSON.stringify({
              success: false,
              error: 'File path and original name are required for store operation',
            });
          }
          storedDocId = await storeDocument(userId, filePath, originalName);
          return JSON.stringify({
            success: true,
            documentId: storedDocId,
            message: 'Document stored successfully',
          });

        case 'search':
          if (!query) {
            return JSON.stringify({
              success: false,
              error: 'Query is required for search operation',
            });
          }
          searchResults = await searchDocuments(userId, query, limit);
          return JSON.stringify({
            success: true,
            results: searchResults.map((doc) => ({
              id: doc.id,
              originalName: doc.originalName,
              fileType: doc.fileType,
              fileSize: doc.fileSize,
              uploadedAt: doc.uploadedAt,
              similarity: doc.similarity,
            })),
            count: searchResults.length,
          });

        case 'list':
          userDocs = listUserDocuments(userId);
          return JSON.stringify({
            success: true,
            documents: userDocs.map((doc) => ({
              id: doc.id,
              originalName: doc.originalName,
              fileType: doc.fileType,
              fileSize: doc.fileSize,
              uploadedAt: doc.uploadedAt,
            })),
            count: userDocs.length,
          });

        case 'delete':
          if (!documentId) {
            return JSON.stringify({
              success: false,
              error: 'Document ID is required for delete operation',
            });
          }
          deleted = await deleteDocument(userId, documentId);
          return JSON.stringify({
            success: deleted,
            message: deleted ? 'Document deleted successfully' : 'Failed to delete document',
          });

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown operation: ${operation}`,
          });
      }
    } catch (error) {
      console.error('[VECTOR_STORE] Error executing vector store tool:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

export { vectorStore };
