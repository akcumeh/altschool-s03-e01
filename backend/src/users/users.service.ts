import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateUserDto {
    name: string;
    email: string;
    password_hash: string;
    role: 'creator' | 'eventee';
}

@Injectable()
export class UsersService {
    constructor(private supabase: SupabaseService) {}

    async findByEmail(email: string) {
        const { data } = await this.supabase.db
            .from('eventful_users')
            .select('*')
            .eq('email', email)
            .single();
        return data;
    }

    async findById(id: string) {
        const { data } = await this.supabase.db
            .from('eventful_users')
            .select('id, name, email, role, created_at')
            .eq('id', id)
            .single();
        return data;
    }

    async create(dto: CreateUserDto) {
        const { data, error } = await this.supabase.db
            .from('eventful_users')
            .insert(dto)
            .select('id, name, email, role, created_at')
            .single();
        if (error) throw error;
        return data;
    }
}
