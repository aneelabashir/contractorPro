const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { Op } = require('sequelize');

const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

//can separate route and controller files and will only call controllers if the middleware are passed
//can log req and res on AWS consle logger
//
/**
 * FIX ME!
 * @returns contract by id
 */
app.get("/contracts/:id", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  try {
    const contract = await Contract.findOne({ where: { id: id } });

    if (!contract) return res.status(404).end();

    res.status(200).json(contract);
  } catch (err) {
    //can implement AWS logging here to log any error
    console.error("An error has occured while fetching contract!:", err);
    res.status(500).end();
  }
});

//1. **_GET_** `/contracts` - Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.

app.get("/contracts", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { profile } = req;
  try {
    const contracts = await Contract.findAll({
      where: {
        [Op.or]: [
          { ClientId: profile.id },
          { ContractorId: profile.id }
      ],
      status: {
          [Op.ne]: 'terminated'
      }
      },
    });

    res.status(200).json(contracts);
  } catch (error) {
    console.error("An error has occured while fetching contracts:", error);
    res.status(500).end();
  }
});
//1. **_GET_** `/jobs/unpaid` - Get all unpaid jobs for a user (**_either_** a client or contractor), for **_active contracts only_**.

app.get("/jobs/unpaid", getProfile, async (req, res) => {
  const { Job, Contract } = req.app.get("models");
  const { profile } = req;

  try {
    const unpaidJobs = await Job.findAll({
      where: {
          [Op.and]: [
              { paid: false },
              {
                  '$Contract.status$': 'in_progress',
                  [Op.or]: [
                      { '$Contract.ClientId$': profile.id },
                      { '$Contract.ContractorId$': profile.id }
                  ]
              }
          ]
      },
      include: [{
          model: Contract,
          attributes: []
      }]
  });

    res.status(200).json(unpaidJobs);
  } catch (error) {
    console.error("Error fetching unpaid jobs:", error);
    res.status(500).end();
  }
});
// 1. **_POST_** `/jobs/:job_id/pay` - Pay for a job, a client can only pay if his balance >= the amount to pay.
//The amount should be moved from the client's balance to the contractor balance.
app.post("/jobs/:job_id/pay", getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");
  const { job_id } = req.params;
  const { profile } = req;

  try {
    const job = await Job.findOne({
      where: {
        id: job_id,
        paid: false,
      },
      include: {
        model: Contract,
        where: {
          [Op.or]: [
            { ClientId: profile.id },
            { ContractorId: profile.id },
          ],
          status: "in_progress",
        },
      },
    });

    if (!job) return res.status(404).end();

    const { price } = job;

    if (profile.type === "client" && profile.balance >= price) {
      // Update client's balance
      await Profile.update(
        { balance: profile.balance - price },
        { where: { id: profile.id } }
      );

      // Update contractor's balance
      const contractor = await Profile.findOne({
        where: { id: job.Contract.ContractorId },
      });
      await Profile.update(
        { balance: contractor.balance + price },
        { where: { id: contractor.id } }
      );

      // Mark job as paid
     const updatedJob =await Job.update(
        { paid: true, paymentDate: new Date() },
        { where: { id: job_id } }
      );

      res.status(200).json({ message: "Payment successful" });
    } else {
      res.status(403).json({ message: "Insufficient funds or not a client" });
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).end();
  }
});
//1. **_POST_** `/balances/deposit/:userId` - Deposits money into the the the balance of a client,
//a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { Profile, Contract, Job } = req.app.get("models");
  const { userId } = req.params;
  const { profile } = req;
  const { amount } = req.body.amount;
  try {
    // 'SELECT SUM(price) as total FROM Jobs WHERE "ContractId" IN (SELECT id FROM Contracts WHERE "ClientId" = :clientId AND "status" = \'in_progress\')',

    const totalJobsToPay = await Job.sum("price", {
      include: [
        {
          model: Contract,
          where: {
            ClientId: userId,
            status: "in_progress",
          },
        },
      ],
    });

    const maxDeposit = totalJobsToPay * 0.25;

    if (maxDeposit <= 0) {
      return res
        .status(403)
        .json({ message: "No jobs in progress or client has paid enough" });
    }

    const currentDeposit = profile.balance - totalJobsToPay;

    if (currentDeposit >= maxDeposit) {
      return res.status(403).json({ message: "Deposit limit reached" });
    }

    const remainingDeposit = maxDeposit - currentDeposit;
    const depositAmount = Math.min(remainingDeposit, amount);

    await Profile.update(
      { balance: profile.balance + depositAmount },
      { where: { id: profile.id } }
    );

    res.status(200).json({ message: "Deposit successful" });
  } catch (error) {
    console.error("Error processing deposit:", error);
    res.status(500).end();
  }
});

//1. **_GET_** `/admin/best-profession?start=<date>&end=<date>` -
//Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.

app.get('/admin/best-profession', getProfile, async (req, res) => {

  const { Contract, Job,Profile } = req.app.get('models'); // Extract models
  
  const { startDate, endDate } = req.query;

  try {
    const bestProfession = await Profile.findAll({
      attributes: ['profession', [sequelize.fn('SUM', sequelize.col('price')), 'earned']],
      include: [
        {
          model: Contract,
          as: 'Contractor',
          attributes: [],
          required: true,
          include: [
            {
              model: Job,
              required: true,
              attributes: [],
              where: {
                paid: true,
                paymentDate: {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate,
                },
              },
            },
          ],
        },
      ],
      where: {
        type: 'contractor',
      },
      group: ['profession'],
      order: [[sequelize.col('earned'), 'DESC']],
      limit: 1,
      subQuery: false,
    });
     
    if (bestProfession.length === 0) {
      return res.status(404).json({ message: 'No data available' });
    }

    res.json(bestProfession[0]);
  } catch (error) {
      console.error('Error fetching best profession:', error);
      res.status(500).end();
  }
});


//1. **_GET_** `/admin/best-clients?start=<date>&end=<date>&limit=<integer>` -
//returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.

app.get("/admin/best-clients", getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get("models");
  const { startDate, endDate, limit } = req.query;

  try {
    const bestClients = await Profile.findAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        [sequelize.fn("SUM", sequelize.col("price")), "paid"],
      ],
      include: [
        {
          model: Contract,
          as: 'Client', 
          attributes: [],
          required: true,
          include: [
            {
              model: Job,
              required: true,
              attributes: [],
              where: {
                paymentDate: {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate,
                },
                paid: true,
              },
            },
          ],
        },
      ],
      where: {
        type: 'client',
      },
      group: ["Profile.id"],
      order: [[sequelize.fn("SUM", sequelize.col("price")), "DESC"]],
      limit: limit ? parseInt(limit, 10) : 2,
      subQuery: false,

    });

    if (bestClients.length === 0) {
      return res.status(404).json({ message: "No data available" });
    }

    res.json(bestClients);
  } catch (error) {
    console.error("Error fetching best clients:", error);
    res.status(500).end();
  }
});

module.exports = app;
