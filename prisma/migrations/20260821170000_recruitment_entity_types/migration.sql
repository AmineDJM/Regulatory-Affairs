-- LES PIÈCES DU RECRUTEMENT : la fiche de poste sur la DEMANDE, le CV sur le CANDIDAT.
--
-- Deux types distincts, et non un seul : un CV appartient à une PERSONNE. Le rattacher à la
-- demande entière rendrait impossible de dire de qui il est — précisément la question qu'on pose
-- devant une pile de candidatures.
--
-- Migration séparée de la création des tables : PostgreSQL refuse d'UTILISER une valeur d'enum
-- dans la transaction qui l'ajoute. Les ajouter ici garantit qu'elles sont disponibles avant
-- toute écriture qui s'en sert.
--
-- Idempotent : ce fichier peut se rejouer sans erreur sur une base déjà migrée.

ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'RECRUITMENT_REQUEST';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'RECRUITMENT_CANDIDATE';
