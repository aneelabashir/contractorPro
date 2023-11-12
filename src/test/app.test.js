const request = require('supertest'); // supertest is a popular library for making HTTP requests in tests
const app = require('../app'); 
const { Profile, Job } = require('../model');

describe('GET /contracts/:id', () => {
  test('returns 200 and the contract details for a valid contract and profile', async () => {
    const response = await request(app)
      .get('/contracts/1') 
      .set('profile_id', '1'); 

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
  });

  test('returns 404 for an invalid contract ID', async () => {
    const response = await request(app)
      .get('/contracts/999') 
      .set('profile_id', '1'); 
    expect(response.status).toBe(404);
  });

  test('returns 401 for unauthorized access', async () => {
    const response = await request(app)
      .get('/contracts/1') 
      .set('profile_id', ''); 

    expect(response.status).toBe(401);
  });
  
});

describe('GET /contracts', () => {
  // Test case for a user with active contracts
  test('returns 200 and a list of non-terminated contracts for a user with active contracts', async () => {
    const response = await request(app)
      .get('/contracts')
      .set('profile_id', '3'); 

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
  });

  // Test case for a user without active contracts
  test('returns 200 and an empty list for a user without active contracts', async () => {
    const response = await request(app)
      .get('/contracts')
      .set('profile_id', '5'); //user with id 5 doesn't have an active contract

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Test case for unauthorized access
  test('returns 401 for unauthorized access', async () => {
    const response = await request(app)
      .get('/contracts')
      .set('profile_id', ''); // No valid profile ID provided

    expect(response.status).toBe(401);
  });

});

describe('GET /jobs/unpaid', () => {
  // Test case for a client with unpaid jobs in an active contract
  test('returns 200 and a list of unpaid jobs for a client with active contracts', async () => {
    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', '2'); // 2 with unpaid jobs

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
  });

  // Test case for a client without unpaid jobs
  test('returns 200 and an empty list for a client without unpaid jobs', async () => {
    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', '5'); // 5 without unpaid jobs

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Test case for unauthorized access
  test('returns 401 for unauthorized access', async () => {
    const response = await request(app)
      .get('/jobs/unpaid')
      .set('profile_id', ''); // No valid profile ID provided

    expect(response.status).toBe(401);
  });

});

describe('POST /jobs/:job_id/pay', () => {
  // Test case for a client successfully paying for a job
//   test('returns 200 and updates balances for client and contractor', async () => {
//     const response = await request(app)
//       .post('/jobs/19/pay') // a new job for the money
//       .set('profile_id', '9'); //client with enough money
//       expect(response.status).toBe(200);
//       expect(response.body).toEqual({ message: 'Payment successful' });
//   });

//   // Test case for a client with insufficient funds
//   test('returns 403 for insufficient funds', async () => {
//     const response = await request(app)
//       .post('/jobs/19/pay') 
//       .set('profile_id', '9'); //  a valid client profile ID with insufficient balance

//     expect(response.status).toBe(403);
//     expect(response.body).toEqual({ message: 'Insufficient funds or not a client' });
//   });

  // Test case for unauthorized access
  test('returns 401 for unauthorized access', async () => {
    const response = await request(app)
      .post('/jobs/16/pay') 
      .set('profile_id', '');

    expect(response.status).toBe(401);
  });

});

describe('POST /balances/deposit/:userId', () => {
    // Test case for a successful deposit
    test('returns 200 and updates the client balance', async () => {
      const response = await request(app)
        .post('/balances/deposit/2')
        .set('profile_id', '2') 
        .send({ amount: 50 }); 
  
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Deposit successful' });
     
    });
  
    // Test case for a client attempting to deposit more than 25% of their total jobs to pay
    // test('returns 403 for exceeding deposit limit', async () => {
    //   const response = await request(app)
    //     .post('/balances/deposit/9') 
    //     .set('profile_id', '9')
    //     .send({ amount: 10000 }); 
  
    //   expect(response.status).toBe(403);
    //   expect(response.body).toEqual({ message: 'Deposit limit reached' });

    // });
  
    // Test case for a client with no jobs in progress or who has paid enough
    test('returns 403 for no jobs in progress or client has paid enough', async () => {
      const response = await request(app)
        .post('/balances/deposit/3') 
        .set('profile_id', '3') 
        .send({ amount: 50 }); 
  
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'No jobs in progress or client has paid enough' });
  
    });
});

describe('GET /admin/best-profession', () => {
  // Test case for a successful request
  test('returns the best profession within the specified date range', async () => {
    const startDate = '2020-01-01'; 
    const endDate = '2020-12-01'; 

    const response = await request(app)
      .get(`/admin/best-profession?startDate=${startDate}&endDate=${endDate}`)
      .set('profile_id', '1'); 
    // console.log('response.body===========',response.body);
   // expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('profession');
    expect(response.body).toHaveProperty('earned');
  });

  // Test case for a request with no data available
  test('returns 404 when no data is available', async () => {
    const startDate = '2022-01-01';
    const endDate = '2022-12-01'; 

    const response = await request(app)
    .get(`/admin/best-profession?startDate=${startDate}&endDate=${endDate}`)
    .set('profile_id', '6'); 

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No data available' });
  });
});

describe('GET /admin/best-clients', () => {
  test('returns the best clients within the specified date range', async () => {
    const response = await request(app)
      .get('/admin/best-clients')
      .set('profile_id', '1')
      .query({
        startDate : '2020-01-01',
        endDate: '2020-12-01',
        limit: '1',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
  });

  test('returns 404 if no data is available', async () => {
    const response = await request(app)
      .get('/admin/best-clients')
      .set('profile_id', '6')
      .query({
        startDate : '2025-01-01',
        endDate: '2025-12-31',
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No data available' });
  });

  test('applies the default limit if no limit is provided', async () => {
    const response = await request(app)
      .get('/admin/best-clients')
      .set('profile_id', '1')
      .query({
        startDate : '2020-01-01',
        endDate: '2020-12-01',
      });

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2); // Default limit is 2
  });

  test('applies the provided limit', async () => {
    const response = await request(app)
      .get('/admin/best-clients')
      .set('profile_id', '1')
      .query({
        startDate : '2020-01-01',
        endDate: '2020-12-01',
        limit: 1, // Custom limit
      });

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1); // Limit is 1
  });
});
