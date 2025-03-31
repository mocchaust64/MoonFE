import { PublicKey } from "@solana/web3.js";

// Common error types
export interface BaseError extends Error {
  code: string;
  details?: unknown;
}

export interface ValidationError extends BaseError {
  field: string;
  message: string;
}

export interface NetworkError extends BaseError {
  statusCode?: number;
  endpoint?: string;
}

// Common response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: BaseError;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Common request types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Common utility types
export type Address = string | PublicKey;

export interface TimeStamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDelete extends TimeStamped {
  deletedAt?: Date;
}

// Common validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Common status types
export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING",
  DELETED = "DELETED",
}

// Common configuration types
export interface AppConfig {
  environment: "development" | "staging" | "production";
  apiUrl: string;
  solanaNetwork: "mainnet-beta" | "testnet" | "devnet";
  rpcEndpoint: string;
  wsEndpoint: string;
}

// Common event types
export interface Event<T = unknown> {
  type: string;
  payload: T;
  timestamp: Date;
}

// Common state types
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface PaginatedState<T> extends LoadingState {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
