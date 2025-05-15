use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(threshold: u8, credential_id: String)]
pub struct InitializeMultisig<'info> {
    #[account(
        init,
        payer = fee_payer,
        space = 8 + 
               1 +  
               1 +  
               8 +  
               1 +  
               8 +  
               8 +  
               32 + 
               4 + credential_id.len(), 
        seeds = [b"multisig".as_ref(), &process_credential_id_seed(&credential_id)],
        bump
    )]
    pub multisig: Account<'info, MultiSigWallet>,
    
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_multisig(
    ctx: Context<InitializeMultisig>,
    threshold: u8,
    credential_id: String,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    
    require!(threshold > 0, WalletError::InvalidConfig);
    require!(credential_id.len() > 0, WalletError::InvalidConfig);
    require!(credential_id.len() <= 64, WalletError::NameTooLong);
    
    multisig.threshold = threshold;
    multisig.guardian_count = 0;
    multisig.recovery_nonce = 0;
    multisig.bump = ctx.bumps.multisig;
    multisig.transaction_nonce = 0;
    multisig.last_transaction_timestamp = 0;
    multisig.owner = ctx.accounts.fee_payer.key();
    multisig.credential_id = credential_id;
    
    Ok(())
}

pub fn process_credential_id_seed(credential_id: &str) -> [u8; 24] {
    msg!("CONTRACT - process_credential_id_seed");
    msg!("Input credential ID: {}", credential_id);
    
    let credential_bytes = credential_id.as_bytes();
    msg!("Credential bytes length: {}", credential_bytes.len());
    
    let bytes_hex = to_hex(credential_bytes);
    msg!("Credential bytes (hex): {}", bytes_hex);
    
    let mut result = [0u8; 24];
    
    if credential_bytes.len() > 24 {
        msg!("Credential ID dài quá 24 bytes, thực hiện hash");
        
       
        for (i, byte) in credential_bytes.iter().enumerate() {
            result[i % 24] ^= *byte;
        }
        
        let result_hex = to_hex(&result);
        msg!("Seed sau khi hash (hex): {}", result_hex);
    } else {
       
        let len = credential_bytes.len();
        result[..len].copy_from_slice(credential_bytes);
        
        let result_hex = to_hex(&result);
        msg!("Seed không hash (hex, padded): {}", result_hex);
    }
    
    result
}

fn to_hex(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let hex = format!("{:02x}", byte);
        result.push_str(&hex);
    }
    result
}

