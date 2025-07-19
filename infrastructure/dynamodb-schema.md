# DynamoDB Table Schema Design for Lunch Cache

## Overview

This document defines the DynamoDB table schema for caching lunch data from restaurants. The schema is designed to support efficient storage and retrieval of lunch menus with automatic expiration and query patterns optimized for the Enhanced Lunch Table application.

## Table Configuration

**Table Name**: `lunch-cache-{environment}` (e.g., `lunch-cache-dev`, `lunch-cache-prod`)

**Billing Mode**: On-Demand (Pay-per-request)

**Region**: `eu-west-1` (Stockholm - closest to Swedish restaurants)

## Primary Key Design

### Partition Key (pk)
- **Type**: String
- **Format**: `{restaurant}-{year}-{week}`
- **Example**: `niagara-2025-03`
- **Purpose**: Ensures unique identification of each restaurant's weekly menu

### Sort Key
- **Not Used**: Single-item per partition design
- **Rationale**: Each restaurant has one menu per week, no need for additional sorting

## Item Attributes

### Required Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `pk` | String (PK) | Partition key: restaurant-year-week | `"niagara-2025-03"` |
| `restaurant` | String | Restaurant name (lowercase) | `"niagara"` |
| `week` | Number | ISO week number (1-53) | `3` |
| `year` | Number | Calendar year | `2025` |
| `lunches` | List | Array of lunch objects | `[{name, price, description, weekday, ...}]` |
| `lunchCount` | Number | Count of lunches for quick stats | `15` |
| `cachedAt` | String | ISO timestamp when cached | `"2025-01-20T10:30:00.000Z"` |
| `ttl` | Number | TTL in Unix timestamp for auto-deletion | `1737889800` |

### Optional Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `metadata` | Map | Additional metadata about the cache entry | `{version: "1.0", source: "niagara-parser"}` |
| `validationErrors` | List | Any validation issues found | `[{field: "price", message: "Invalid format"}]` |
| `dataQuality` | Map | Quality metrics | `{completeness: 0.95, accuracy: 0.98}` |
| `lastUpdated` | String | Source website last modified | `"2025-01-20T08:00:00.000Z"` |

## Lunch Object Schema

Each item in the `lunches` array follows this structure:

```json
{
  "name": "Köttbullar med gräddsås",
  "description": "Serveras med kokt potatis och lingonsylt",
  "price": 125,
  "weekday": "måndag",
  "week": 3,
  "place": "Niagara"
}
```

### Lunch Object Attributes

| Field | Type | Required | Validation | Example |
|-------|------|----------|------------|---------|
| `name` | String | Yes | Non-empty string | `"Köttbullar med gräddsås"` |
| `description` | String | No | String or empty | `"Serveras med kokt potatis"` |
| `price` | Number | Yes | Positive number | `125` |
| `weekday` | String | Yes | Swedish weekday | `"måndag"` |
| `week` | Number | Yes | 1-53 | `3` |
| `place` | String | Yes | Restaurant name | `"Niagara"` |

## Global Secondary Index (GSI)

### RestaurantIndex

**Purpose**: Query all cache entries for a specific restaurant across different weeks

**Partition Key**: `restaurant` (String)
**Sort Key**: `cachedAt` (String)
**Projection**: All attributes

**Query Patterns**:
- Get recent cache entries for a restaurant
- Find data quality issues across weeks
- Restaurant-specific cache statistics

## Access Patterns

### 1. Store Weekly Menu
```
PutItem(pk: "niagara-2025-03", ...)
```

### 2. Retrieve Current Week's Menu
```
GetItem(pk: "niagara-2025-03")
```

### 3. Get Restaurant Cache History
```
Query(GSI: RestaurantIndex, restaurant: "niagara", ScanIndexForward: false)
```

### 4. Cleanup Expired Cache
```
Scan(FilterExpression: "ttl < :now")
```

### 5. Health Check
```
PutItem + GetItem + DeleteItem (test operations)
```

## TTL Configuration

### TTL Attribute
- **Field**: `ttl`
- **Type**: Number (Unix timestamp)
- **Default**: 14 days from creation
- **Purpose**: Automatic cleanup of old cache entries

### TTL Calculation
```javascript
const ttlTimestamp = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60); // 14 days
```

## Capacity Planning

### Initial Capacity Estimates

**Data Volume**:
- 10 restaurants × 52 weeks × 15 lunches/week = 7,800 lunch items/year
- Average item size: ~2KB
- Total storage: ~15MB/year (very small)

**Request Patterns**:
- **Reads**: 100-500 requests/day (lunch viewing)
- **Writes**: 10-50 requests/week (cache updates)
- **Deletes**: Automatic via TTL

**Billing Mode**: On-Demand (recommended for low, unpredictable traffic)

## Backup and Recovery

### Point-in-Time Recovery
- **Status**: Enabled
- **Retention**: 35 days
- **Purpose**: Protection against accidental data loss

### Backup Strategy
- **Type**: Continuous backups via PITR
- **Manual Backups**: Not required (data is cacheable/regeneratable)
- **Cross-Region**: Not required (single region deployment)

## Security Configuration

### Encryption
- **At Rest**: AWS managed keys (AES-256)
- **In Transit**: TLS 1.2+
- **Client Side**: Not required (non-sensitive data)

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-1:*:table/lunch-cache-*",
        "arn:aws:dynamodb:eu-west-1:*:table/lunch-cache-*/index/*"
      ]
    }
  ]
}
```

## Monitoring and Alarms

### CloudWatch Metrics
- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`
- `UserErrors` (4xx)
- `SystemErrors` (5xx)
- `SuccessfulRequestLatency`

### Alarms
- High error rate (>5% for 5 minutes)
- High latency (>100ms average for 5 minutes)
- Throttling events

## Data Migration Strategy

### Initial Setup
1. Create table with schema
2. Enable TTL on `ttl` attribute
3. Create GSI `RestaurantIndex`
4. Validate with test data

### Schema Evolution
- **Backward Compatible**: Add new optional attributes
- **Breaking Changes**: Create new table version, migrate data
- **Rollback Plan**: Keep previous table for 30 days

## Cost Optimization

### Storage
- Use TTL to automatically clean old data
- Monitor unused attributes
- Consider item compression for large descriptions

### Requests
- Implement client-side caching (1-hour TTL)
- Batch operations where possible
- Use eventually consistent reads for non-critical operations

### Monitoring
- Set up billing alerts at $5, $10, $25 monthly spend
- Review DynamoDB cost insights monthly
- Consider provisioned capacity if usage becomes predictable

## Testing Strategy

### Unit Tests
- Cache key generation
- Item serialization/deserialization
- TTL calculation
- Error handling

### Integration Tests
- Table operations (CRUD)
- GSI queries
- TTL functionality
- Backup/restore procedures

### Load Tests
- 1000 concurrent reads
- Batch write operations
- Query performance on GSI
- Auto-scaling behavior

## Implementation Checklist

- [ ] Create CloudFormation/Serverless template
- [ ] Configure TTL on table
- [ ] Set up GSI for restaurant queries
- [ ] Implement monitoring and alarms
- [ ] Create IAM roles and policies
- [ ] Set up backup configuration
- [ ] Validate schema with test data
- [ ] Document operational procedures