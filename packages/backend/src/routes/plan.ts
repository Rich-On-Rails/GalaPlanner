import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { PlanRequest, PlanResponse, PlanWithAnalysis } from '@gala-planner/shared';
import { storage } from '../services/storage';
import { generatePlans, explainPlan } from '../planner';

export async function planRoutes(app: FastifyInstance) {
  app.post(
    '/api/plan',
    async (
      request: FastifyRequest<{ Body: PlanRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          parseResultId,
          constraints,
          maxPlans = 5,
          includeExplanations = true,
          dayId,
        } = request.body;

        // Validate request
        if (!parseResultId) {
          return reply.status(400).send({
            success: false,
            error: 'parseResultId is required',
          } satisfies PlanResponse);
        }

        if (!constraints) {
          return reply.status(400).send({
            success: false,
            error: 'constraints object is required',
          } satisfies PlanResponse);
        }

        // Get the parse result
        const parseResult = storage.getParseResult(parseResultId);
        if (!parseResult) {
          return reply.status(404).send({
            success: false,
            error: 'Parse result not found. Please upload a file first.',
          } satisfies PlanResponse);
        }

        // Filter services by day if specified (for multi-day timetables)
        const services = dayId
          ? parseResult.services.filter((s) => s.day === dayId)
          : parseResult.services;

        // Ensure constraints has required fields with defaults
        const normalizedConstraints = {
          timeWindow: constraints.timeWindow,
          mustSeeLocoIds: constraints.mustSeeLocoIds || [],
          stationPreferences: constraints.stationPreferences || {
            prefer: [],
            avoid: [],
          },
          breaks: constraints.breaks || [],
          transferBufferMinutes: constraints.transferBufferMinutes ?? 5,
        };

        // Generate plans
        const plans = generatePlans({
          services,
          stations: parseResult.stations,
          locomotives: parseResult.locomotives,
          constraints: normalizedConstraints,
          maxPlans,
        });

        // Generate analysis if requested
        let plansWithAnalysis: PlanWithAnalysis[] | undefined;
        if (includeExplanations && plans.length > 0) {
          plansWithAnalysis = plans.map((plan) => ({
            plan,
            analysis: explainPlan(
              plan,
              services,
              parseResult.stations,
              parseResult.locomotives,
              normalizedConstraints
            ),
          }));
        }

        request.log.info(
          { parseResultId, plansGenerated: plans.length, withAnalysis: includeExplanations },
          'Plans generated successfully'
        );

        return reply.status(200).send({
          success: true,
          plans,
          plansWithAnalysis,
        } satisfies PlanResponse);
      } catch (error) {
        request.log.error(error, 'Plan generation failed');
        return reply.status(500).send({
          success: false,
          error: 'Internal server error during plan generation',
        } satisfies PlanResponse);
      }
    }
  );
}
