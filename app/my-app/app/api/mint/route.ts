import {
    ActionPostResponse,
    ACTIONS_CORS_HEADERS,
    createPostResponse,
    ActionGetResponse,
    ActionPostRequest,
  } from "@solana/actions";
  import {
    SystemProgram,
    clusterApiUrl,
    Connection,
    PublicKey,
    Transaction,
    Keypair,
  } from "@solana/web3.js";
  import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
  } from "@solana/spl-token";
  
  import * as anchor from "@coral-xyz/anchor";
  
  import ActionExampleJson from "@/app/idl/action_example.json";
  import { type ActionExample } from "@/app/idl/action_example";
  
  export const GET = async (req: Request) => {
    const payload: ActionGetResponse = {
      title: "XueDAO NFT",
      icon: new URL(
        "/nft.png",
        new URL(req.url).origin
      ).toString(),
      description:
        "Simple click to mint your NFT.",
      label: "Mint XueDAO NFT",
      links:
      {
        "actions": [
          {
            label: "mint",
            href: "/api/mint?name={name}&symbol={symbol}&url={url}",
            parameters: [
              // {name} input field
              {
                name: "name",
                label: "Name",
                type: "text",
              },
              // {symbol} input field
              {
                name: "symbol",
                label: "Symbol",
                type: "text",
              },
              // {url} input field
              {
                name: "url",
                label: "URL",
                type: "text",
              }
            ]
          }
        ]
      }
    };
  
    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  };
  
  export const OPTIONS = GET;
  
  export const POST = async (req: Request) => {
    try {
      const body: ActionPostRequest = await req.json();
      // Validate to confirm the user publickey received is valid before use
      let account: PublicKey;
      try {
        account = new PublicKey(body.account);
      } catch (err) {
        return new Response('Invalid "account" provided', {
          status: 400,
          headers: ACTIONS_CORS_HEADERS, //Must include CORS HEADERS
        });
      }

      // const connection = new Connection(providerUrl);
      const connection = new Connection(clusterApiUrl('devnet'), {
        commitment: "confirmed",
      });
      const program = new anchor.Program<ActionExample>(ActionExampleJson as ActionExample, {connection});
  
      const metadata = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      
      const mint = Keypair.generate();

      const masterEditionAccount = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), metadata.toBuffer() , mint.publicKey.toBuffer(), Buffer.from("edition")],
        metadata,
      )[0];
    
      const nftMetadata = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), metadata.toBuffer(), mint.publicKey.toBuffer()],
        metadata,
      )[0];
  
      const accounts = {
        authority: account,
        payer: account,
        mint: mint.publicKey,
        associatedTokenprogram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        masterEditionAccount,
        nftMetadata,
      };

      // Determined Escrow and Vault addresses
      const params = new URL(req.url).searchParams;
      const name = params.get("name");
      const symbol = params.get("symbol");
      const url = params.get("url");
      if (!name || !symbol || !url) {
        return new Response("Invalid parameters", {
          status: 400,
          headers: ACTIONS_CORS_HEADERS,
        });
      }

      // const name =Buffer.from("Dappio Gang");
      // const symbol = Buffer.from("DAPG");
      // const url = Buffer.from("https://gateway.pinata.cloud/ipfs/QmWqzpzBGQyEi3CN4EcDDxKY7cU2Y2SXcuKESkfomG1KBy");
      const claimInstruction = await program.methods
        .createSingleNft(name, symbol,url)
        .accounts({ ...accounts })
        .signers([mint])
        .instruction();
  
      // Create a transaction and add the transfer instruction
      const transaction = new Transaction().add(claimInstruction);
      // Set the recent blockhash and fee payer
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      transaction.feePayer = account;
  
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: "Successfully claimed!",
        },
        signers: [mint],
      });
  
      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (err) {
      console.log(err);
      let message = "An unknown error occurred";
      if (typeof err == "string") message = err;
      return new Response(message, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS, //Must include CORS HEADERS
      });
    }
  };
  
  export const runtime = 'edge' // 'nodejs' (default) | 'edge'
