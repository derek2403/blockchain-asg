#!/bin/bash

# Event Scanner Subgraph Deployment Script
echo "🚀 Starting Event Scanner Subgraph Deployment..."

# Check if graph CLI is installed
if ! command -v graph &> /dev/null; then
    echo "❌ Graph CLI not found. Please install it first:"
    echo "npm install -g @graphprotocol/graph-cli"
    exit 1
fi

# Check if we're in the subgraph directory
if [ ! -f "subgraph.yaml" ]; then
    echo "❌ Please run this script from the subgraph directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Generating code from schema..."
npm run codegen

if [ $? -ne 0 ]; then
    echo "❌ Code generation failed"
    exit 1
fi

echo "🏗️ Building subgraph..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful!"

# Check if deploy key is provided
if [ -z "$1" ]; then
    echo "⚠️  No deploy key provided"
    echo "Please provide your Subgraph Studio deploy key:"
    echo "./deploy.sh YOUR_DEPLOY_KEY"
    exit 1
fi

echo "🔑 Authenticating with Subgraph Studio..."
graph auth $1

if [ $? -ne 0 ]; then
    echo "❌ Authentication failed"
    exit 1
fi

echo "🚀 Deploying subgraph..."
npm run deploy

if [ $? -eq 0 ]; then
    echo "✅ Subgraph deployed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to https://studio.thegraph.com/"
    echo "2. Find your deployed subgraph"
    echo "3. Copy the Query URL"
    echo "4. Update the Apollo Client URI in pages/event-scanner.js"
    echo ""
    echo "🌐 Your subgraph will be available for querying once it's synced"
else
    echo "❌ Deployment failed"
    exit 1
fi 