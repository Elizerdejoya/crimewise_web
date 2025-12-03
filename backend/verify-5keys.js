#!/usr/bin/env node

/**
 * Verification Script for 5-Key API Implementation
 * Checks that everything is properly configured and working
 */

const http = require('http');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    '✓': `${colors.green}✓${colors.reset}`,
    '✗': `${colors.red}✗${colors.reset}`,
    '⚠': `${colors.yellow}⚠${colors.reset}`,
    'ℹ': `${colors.cyan}ℹ${colors.reset}`
  };
  console.log(`${prefix[level]} [${timestamp}] ${message}`);
}

async function getMetrics(host = 'localhost', port = 3000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: '/api/ai-grader/metrics',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function verify() {
  console.log(`\n${colors.blue}=== 5-Key API Implementation Verification ===${colors.reset}\n`);

  // Check 1: API Connectivity
  log('ℹ', 'Checking API connectivity...');
  let metrics;
  try {
    metrics = await getMetrics();
    log('✓', 'API is responding');
  } catch (err) {
    log('✗', `API not responding: ${err.message}`);
    log('ℹ', 'Make sure server is running: npm start');
    process.exit(1);
  }

  // Check 2: Keys Loaded
  log('ℹ', 'Checking API keys configuration...');
  const keyCount = metrics.apiKeys.length;
  if (keyCount === 0) {
    log('✗', 'No API keys found!');
    log('ℹ', 'Add GEMINI_API_KEY_1 through GEMINI_API_KEY_5 to .env');
  } else if (keyCount < 5) {
    log('⚠', `Only ${keyCount}/5 keys configured`);
  } else {
    log('✓', `All 5 API keys loaded`);
  }

  // Check 3: Key Health
  log('ℹ', 'Checking key health status...');
  const healthyKeys = metrics.apiKeys.filter(k => k.healthy).length;
  const unhealthyKeys = metrics.apiKeys.filter(k => !k.healthy).length;
  
  if (healthyKeys === keyCount) {
    log('✓', `All ${keyCount} keys are healthy`);
  } else {
    log('⚠', `${healthyKeys}/${keyCount} keys healthy, ${unhealthyKeys} unhealthy`);
  }

  // Check 4: Token Availability
  log('ℹ', 'Checking token availability...');
  const tokens = metrics.apiKeys.map(k => parseFloat(k.tokens || 0));
  const minTokens = Math.min(...tokens);
  const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
  
  if (avgTokens > 8) {
    log('✓', `Good token levels (avg: ${avgTokens.toFixed(1)}/9)`);
  } else if (avgTokens > 5) {
    log('⚠', `Moderate token levels (avg: ${avgTokens.toFixed(1)}/9)`);
  } else {
    log('⚠', `Low token levels (avg: ${avgTokens.toFixed(1)}/9)`);
  }

  // Check 5: Success Rates
  log('ℹ', 'Checking success rates...');
  const successRates = metrics.apiKeys.map(k => k.successRate || 0);
  const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const minSuccessRate = Math.min(...successRates);
  
  if (avgSuccessRate > 95) {
    log('✓', `Excellent success rate (avg: ${avgSuccessRate.toFixed(0)}%)`);
  } else if (avgSuccessRate > 85) {
    log('⚠', `Good success rate (avg: ${avgSuccessRate.toFixed(0)}%)`);
  } else {
    log('⚠', `Low success rate (avg: ${avgSuccessRate.toFixed(0)}%)`);
  }
  
  if (minSuccessRate < 90 && minSuccessRate > 0) {
    log('⚠', `Key with lowest success rate: ${minSuccessRate}%`);
  }

  // Check 6: Queue Status
  log('ℹ', 'Checking queue status...');
  const queue = metrics.queue || [];
  const pending = queue.find(q => q.status === 'pending')?.count || 0;
  const processing = queue.find(q => q.status === 'processing')?.count || 0;
  const done = queue.find(q => q.status === 'done')?.count || 0;
  
  if (pending > 50) {
    log('⚠', `High pending queue: ${pending} items`);
  } else if (pending > 20) {
    log('⚠', `Moderate pending queue: ${pending} items`);
  } else if (pending > 0) {
    log('✓', `Normal pending queue: ${pending} items`);
  } else {
    log('✓', `Queue is empty (${done} completed items)`);
  }

  // Summary
  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`Keys Loaded:        ${keyCount}/5`);
  console.log(`Keys Healthy:       ${healthyKeys}/${keyCount}`);
  console.log(`Avg Token Level:    ${avgTokens.toFixed(1)}/9`);
  console.log(`Avg Success Rate:   ${avgSuccessRate.toFixed(0)}%`);
  console.log(`Total Requests:     ${metrics.summary?.totalRequests || 0}`);
  console.log(`Queue Pending:      ${pending}`);
  console.log(`Queue Processing:   ${processing}`);
  console.log(`Queue Completed:    ${done}`);

  // Detailed Key Info
  console.log(`\n${colors.blue}=== Key Details ===${colors.reset}`);
  metrics.apiKeys.forEach((k, idx) => {
    const healthStatus = k.healthy ? `${colors.green}●${colors.reset}` : `${colors.red}●${colors.reset}`;
    const tokenBar = '█'.repeat(Math.floor(k.tokens)) + '░'.repeat(9 - Math.floor(k.tokens));
    console.log(`Key ${k.id}: ${healthStatus} Tokens:[${tokenBar}] Success:${k.successRate}% Reqs:${k.requests}`);
  });

  // Recommendations
  console.log(`\n${colors.blue}=== Recommendations ===${colors.reset}`);
  
  if (keyCount < 5) {
    log('ℹ', `Add ${5 - keyCount} more keys for full 45 RPM capacity`);
  }
  
  if (unhealthyKeys > 0) {
    log('ℹ', 'Check .env for invalid API keys or check Google Cloud quota');
  }
  
  if (avgTokens < 5) {
    log('ℹ', 'System is under heavy load, consider adding more keys or reducing peak load');
  }
  
  if (avgSuccessRate < 90) {
    log('ℹ', 'Check API key configuration and Google Cloud project quotas');
  }
  
  if (pending > 50) {
    log('ℹ', 'Increase AI_WORKER_CONCURRENCY in .env or reduce peak load');
  }

  console.log(`\n${colors.green}✓ Verification complete${colors.reset}\n`);
}

// Run verification
verify().catch(err => {
  log('✗', `Verification failed: ${err.message}`);
  process.exit(1);
});
