import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework";
import Stripe from "stripe";

if (!process.env.STRIPE_API_KEY) {
  throw new Error('STRIPE_API_KEY environment variable is not set')
}
const stripe = new Stripe(process.env.STRIPE_API_KEY)

export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string }

  const paymentMethod = await stripe.paymentMethods.retrieve(id);
  res.status(200).json(paymentMethod);
};
