# DynamoDB Capacity Planning for Lunch Cache

## Overview

This document outlines the capacity planning strategy for the Enhanced Lunch Table DynamoDB cache, including load analysis, billing mode selection, and scaling considerations.

## Load Analysis

### Data Volume Projections

**Current State (2025)**:
- Restaurants: 1 (Niagara)
- Weeks per year: 52
- Lunches per week: 5-15 items
- Item size: ~2KB average

**Near-term Growth (1-2 years)**:
- Restaurants: 5-10
- Weekly data: 250-520 items
- Annual storage: ~1-2MB
- Total items: ~2,600-5,200/year

**Long-term Growth (3-5 years)**:
- Restaurants: 25-50
- Weekly data: 1,250-2,600 items
- Annual storage: ~5-10MB
- Total items: ~13,000-26,000/year

### Request Patterns

#### Read Operations
- **Peak Hours**: 11:00-14:00 CET (lunch time)
- **Daily Reads**: 100-500 requests
- **Peak RPS**: 5-10 requests/second
- **Pattern**: Lunch menu viewing, highly predictable

#### Write Operations
- **Schedule**: Weekly data collection (Mondays 10:00 UTC)
- **Weekly Writes**: 10-50 requests
- **Batch Size**: 5-25 items per restaurant
- **Pattern**: Bulk updates, low frequency

#### Query Operations
- **Restaurant History**: 1-5 queries/day
- **Cache Statistics**: 1-10 queries/day
- **Health Checks**: 288 requests/day (every 5 minutes)

## Billing Mode Selection

### On-Demand vs Provisioned Comparison

| Factor | On-Demand | Provisioned |
|--------|-----------|-------------|
| **Cost Predictability** | Variable | Fixed |
| **Traffic Patterns** | Irregular/Unpredictable | Steady/Predictable |
| **Management Overhead** | None | High |
| **Auto-scaling** | Automatic | Manual/Auto-scaling |
| **Cold Start** | Instant | Potential throttling |

### Recommendation: On-Demand

**Selected**: On-Demand billing mode

**Rationale**:
1. **Low Traffic Volume**: <1000 requests/day doesn't justify provisioned capacity
2. **Irregular Patterns**: Lunch-time spikes are hard to predict precisely
3. **Minimal Management**: No capacity planning or auto-scaling configuration needed
4. **Cost Efficiency**: Pay-per-request is cheaper for low-volume applications
5. **Burst Tolerance**: Handles unexpected traffic spikes automatically

### Cost Analysis (On-Demand)

#### Monthly Cost Estimates (eu-west-1)

**Current Load (1 restaurant)**:
- Reads: 3,000/month × $0.25/million = $0.0008
- Writes: 200/month × $1.25/million = $0.0003
- Storage: 0.1GB × $0.25/GB = $0.025
- **Total**: ~$0.03/month

**Near-term Load (10 restaurants)**:
- Reads: 15,000/month × $0.25/million = $0.004
- Writes: 2,000/month × $1.25/million = $0.003
- Storage: 1GB × $0.25/GB = $0.25
- **Total**: ~$0.26/month

**Long-term Load (50 restaurants)**:
- Reads: 75,000/month × $0.25/million = $0.019
- Writes: 10,000/month × $1.25/million = $0.013
- Storage: 5GB × $0.25/GB = $1.25
- **Total**: ~$1.28/month

## Performance Requirements

### Latency Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| GetItem | <10ms | <50ms |
| PutItem | <20ms | <100ms |
| Query (GSI) | <20ms | <100ms |
| Batch Operations | <100ms | <500ms |

### Throughput Requirements

| Period | Read RCU | Write RCU | Notes |
|--------|----------|-----------|-------|
| **Peak Hour** | 10-20 | 1-2 | Lunch viewing time |
| **Collection Window** | 1-5 | 50-100 | Monday data updates |
| **Off-peak** | 1-5 | 0-1 | Minimal activity |
| **Burst** | 100 | 50 | Error recovery scenarios |

## Scaling Strategy

### Automatic Scaling (On-Demand)

**Benefits**:
- Instant scaling to handle any load
- No configuration required
- Handles both gradual growth and sudden spikes
- Zero downtime scaling events

**Monitoring**:
- CloudWatch metrics for consumed capacity
- Cost monitoring and alerts
- Performance metrics (latency, errors)

### Capacity Thresholds

**Scale Consideration Points**:
1. **$10/month**: Review billing mode efficiency
2. **$50/month**: Consider provisioned capacity with auto-scaling
3. **$100/month**: Implement advanced optimization strategies

### Migration to Provisioned (if needed)

**Triggers**:
- Consistent traffic patterns emerge
- Monthly costs exceed $25
- Predictable read/write patterns for 3+ months

**Process**:
1. Analyze 30-day CloudWatch metrics
2. Calculate optimal provisioned capacity
3. Plan migration during low-traffic window
4. Configure auto-scaling policies
5. Monitor for cost/performance improvements

## Monitoring and Alerting

### Key Metrics

#### Performance Metrics
- `SuccessfulRequestLatency` (target: <50ms average)
- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`
- `ItemCount` (table size monitoring)

#### Error Metrics
- `UserErrors` (4xx responses)
- `SystemErrors` (5xx responses)
- `ThrottledRequests` (should be 0 for on-demand)

#### Cost Metrics
- Daily/Monthly consumed capacity costs
- Storage costs
- Total DynamoDB spend

### CloudWatch Alarms

#### Performance Alarms
```yaml
HighLatencyAlarm:
  MetricName: SuccessfulRequestLatency
  Threshold: 100ms
  Evaluation: 2 periods of 5 minutes

HighErrorRateAlarm:
  MetricName: UserErrors
  Threshold: 5 errors
  Evaluation: 1 period of 5 minutes
```

#### Cost Alarms
```yaml
MonthlyCostAlarm:
  MetricName: EstimatedCharges
  Threshold: $5
  Currency: USD
  
DailyCostAlarm:
  MetricName: EstimatedCharges
  Threshold: $0.50
  Currency: USD
```

## Optimization Strategies

### Data Optimization

#### Item Size Reduction
- Compress large text fields (descriptions)
- Use abbreviated attribute names for frequently accessed fields
- Remove unnecessary metadata in production

#### TTL Optimization
- Current: 14 days retention
- Monitor: Actual data usage patterns
- Adjust: Reduce to 7 days if usage allows

### Query Optimization

#### Access Pattern Analysis
- Monitor most frequent query patterns
- Optimize GSI design based on actual usage
- Consider additional indexes for new query patterns

#### Caching Strategy
- Client-side caching (1-hour TTL for reads)
- Lambda memory caching for frequently accessed data
- CDN caching for static content

### Batch Operations

#### Write Optimization
- Use `BatchWriteItem` for bulk operations
- Implement exponential backoff for retries
- Parallelize restaurant data collection

#### Read Optimization
- Implement `BatchGetItem` for multi-restaurant queries
- Use eventually consistent reads where appropriate
- Optimize projection expressions to reduce data transfer

## Disaster Recovery

### Backup Strategy

#### Point-in-Time Recovery
- **Enabled**: 35-day retention
- **RTO**: <1 hour for recent data
- **RPO**: Seconds (continuous backup)

#### Cross-Region Considerations
- **Current**: Single region (eu-west-1)
- **Future**: Consider Global Tables if multi-region needed
- **Cost**: Monitor if cross-region replication justified

### Recovery Procedures

#### Data Loss Scenarios
1. **Recent data loss**: Use PITR to restore to specific timestamp
2. **Corruption**: Restore from backup, re-run data collection
3. **Complete table loss**: Recreate table, populate from source websites

#### Business Continuity
- **Graceful Degradation**: API serves cached HTML without dynamic data
- **Fallback**: Direct website parsing if cache unavailable
- **Recovery Time**: <2 hours for full service restoration

## Testing Strategy

### Load Testing

#### Test Scenarios
1. **Normal Load**: 100 reads/hour, 10 writes/week
2. **Peak Load**: 500 reads/hour during lunch time
3. **Burst Load**: 1000 reads in 5 minutes
4. **Batch Load**: 50 concurrent writes

#### Tools
- Artillery.io for HTTP load testing
- AWS SDK scripts for direct DynamoDB testing
- CloudWatch synthetic monitoring

### Performance Benchmarks

#### Baseline Metrics (empty table)
- GetItem: <5ms
- PutItem: <10ms
- Query: <15ms

#### Target Metrics (production load)
- GetItem: <10ms average
- PutItem: <20ms average
- Query: <25ms average

## Implementation Checklist

### Phase 1: Basic Setup
- [x] Choose On-Demand billing mode
- [x] Configure TTL for automatic cleanup
- [x] Set up basic CloudWatch monitoring
- [ ] Implement cost alerting

### Phase 2: Monitoring
- [ ] Deploy performance monitoring dashboard
- [ ] Set up automated capacity reporting
- [ ] Configure alerting thresholds
- [ ] Implement cost tracking

### Phase 3: Optimization
- [ ] Analyze actual usage patterns
- [ ] Optimize item structure based on access patterns
- [ ] Implement advanced caching strategies
- [ ] Consider provisioned capacity if beneficial

### Phase 4: Scaling
- [ ] Plan for multi-restaurant expansion
- [ ] Design capacity monitoring automation
- [ ] Implement predictive scaling analysis
- [ ] Document scaling procedures

## Review Schedule

### Regular Reviews
- **Weekly**: Cost and performance metrics review
- **Monthly**: Capacity utilization analysis
- **Quarterly**: Billing mode efficiency evaluation
- **Annually**: Complete capacity planning review

### Triggers for Review
- 50% increase in monthly costs
- New performance requirements
- Adding >5 new restaurants
- Sustained latency issues (>100ms average)

## Conclusion

The On-Demand billing mode provides the optimal balance of cost efficiency, performance, and operational simplicity for the Enhanced Lunch Table application. The automatic scaling capabilities handle growth and traffic spikes without manual intervention, while the monitoring strategy ensures early detection of any capacity or performance issues.

As the application scales beyond 10 restaurants or monthly costs exceed $25, a migration to provisioned capacity with auto-scaling should be evaluated for potential cost savings.